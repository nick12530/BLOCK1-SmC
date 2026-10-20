/**
 * App.tsx - NIFTY Institutional SMC Trading Terminal
 * Minimalist, high-performance layout:
 * - Pure trading focus: Real-time Chart + Signal Engine + Active Positions HUD
 * - No extra cluttered tabs or dealing range cards
 * - Top Header with currency switcher, live telemetry, and modal triggers
 * - Essential safeguards: Persistent KillSwitchBanner & Daily Loss Circuit Breaker
 * - Complete modal access (MT5 Bridge, Risk Rules, Audit Journal, Daily Report, Help Center, Webhooks)
 * - Retains all verified safety gates, strict closed-candle logic & MT5 broker reconciliation
 */

import React, { Suspense, lazy, useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from './hooks/useTheme';
import {
  useTicker,
  useMarket,
  usePositions,
  useEngine,
} from './hooks/useTradingStore';
import { tradingEngine } from './engine/tradingEngine';
import { mt5Bridge } from './engine/mt5Bridge';
import { useAudioNotifications } from './hooks/useAudioNotifications';
import { SupportedSymbol, INSTRUMENTS } from './engine/instrumentConfig';
import { Signal, TerminalSnapshot } from './types/smc';
import { localDayKey } from './engine/tradeJournal';

// Layout & Safety Components
import { HeaderView } from './components/HeaderView';
import { KillSwitchBanner } from './components/KillSwitchBanner';
import { WeekendMarketBanner } from './components/WeekendMarketBanner';
import { FooterView } from './components/FooterView';
import { ConfirmDialog } from './components/ConfirmDialog';
import { WorkspaceErrorBoundary } from './components/ErrorBoundary';

// Control Bar
import { TerminalUtilitiesBar } from './components/TerminalUtilitiesBar';

// Core Charting & Execution
import { TradingViewWidget } from './components/TradingViewWidget';
import { SignalEngineCard } from './components/SignalEngineCard';
import { RunningTradesHUD } from './components/RunningTradesHUD';

// Floating Notification Beacon
import { SignalToastNotification } from './components/SignalToastNotification';

// Icons
import { AlertTriangle } from 'lucide-react';

// Lazy-loaded Modals
const Mt5BridgeModal = lazy(() =>
  import('./components/Mt5BridgeModal').then((m) => ({ default: m.Mt5BridgeModal }))
);
const RiskSettingsModal = lazy(() =>
  import('./components/RiskSettingsModal').then((m) => ({ default: m.RiskSettingsModal }))
);
const ClosedTradesModal = lazy(() =>
  import('./components/ClosedTradesModal').then((m) => ({ default: m.ClosedTradesModal }))
);
const DailyReportModal = lazy(() =>
  import('./components/DailyReportModal').then((m) => ({ default: m.DailyReportModal }))
);
const TradingViewModal = lazy(() =>
  import('./components/TradingViewModal').then((m) => ({ default: m.TradingViewModal }))
);
const HelpCenterModal = lazy(() =>
  import('./components/HelpCenterModal').then((m) => ({ default: m.HelpCenterModal }))
);
const MobileServerModal = lazy(() =>
  import('./components/MobileServerModal').then((m) => ({ default: m.MobileServerModal }))
);
const WebhookSettingsModal = lazy(() =>
  import('./components/WebhookSettingsModal').then((m) => ({ default: m.WebhookSettingsModal }))
);

export default function App() {
  const { isDark, toggleTheme } = useTheme();

  // Engine channel hooks
  const ticker = useTicker();
  const market = useMarket();
  const positionsState = usePositions();
  const engine = useEngine();

  const activeSymbol = (ticker.symbol || 'XAUUSD') as SupportedSymbol;
  const instrumentCfg = INSTRUMENTS[activeSymbol] || INSTRUMENTS.XAUUSD;

  // Active modal
  const [activeModal, setActiveModal] = useState<
    'bridge' | 'settings' | 'closed_trades' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa' | 'webhook' | null
  >(null);
  const [reportDate, setReportDate] = useState(() => localDayKey(new Date()));

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Audio alerts hook
  useAudioNotifications();

  // MT5 Bridge event listeners
  useEffect(() => {
    mt5Bridge.setCallback((snapshot) => tradingEngine.syncMt5Snapshot(snapshot));
    mt5Bridge.setClosedTradesCallback((trades) => tradingEngine.syncMt5ClosedTrades(trades));
    mt5Bridge.setConnectionChangeCallback((connected, error) =>
      tradingEngine.setMt5BridgeConnectionStatus(connected, error)
    );

    void mt5Bridge.autoConnectIfSaved().catch(() => {});
  }, []);

  // Request Kill Switch Toggle with confirmation dialog
  const handleRequestKillSwitchToggle = useCallback(() => {
    const isArmed = engine.kill_switch;
    setConfirmDialog({
      title: isArmed ? 'Disarm Kill Switch?' : 'Arm Emergency Kill Switch?',
      message: isArmed
        ? 'Disarming the Kill Switch will re-enable automated execution and manual trade orders.'
        : 'Arming the Kill Switch will immediately block all orders across all currency pairs.',
      confirmLabel: isArmed ? 'Disarm Kill Switch' : 'ARM KILL SWITCH',
      isDestructive: !isArmed,
      onConfirm: () => {
        tradingEngine.toggleKillSwitch();
        setConfirmDialog(null);
      },
    });
  }, [engine.kill_switch]);

  // Execute trade handler from SignalEngineCard
  const handleExecuteSignal = useCallback(
    (customVolume?: number, positionCount?: number, signal?: Signal) => {
      const sig = signal || market.signal;
      if (!sig) return;

      if (engine.kill_switch) {
        setConfirmDialog({
          title: 'Kill Switch is Armed',
          message: 'All trade execution is blocked while the Kill Switch is armed.',
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      const count = positionCount || 1;
      const vol = customVolume || 0.01;

      for (let i = 0; i < count; i++) {
        const res = tradingEngine.sendMarket(
          sig.direction,
          vol,
          sig.sl,
          sig.tp,
          sig.strategy,
          activeSymbol
        );

        if (!res.ok) {
          setConfirmDialog({
            title: 'Order Blocked by Risk Controls',
            message: res.error || 'Execution was rejected by safety checks.',
            confirmLabel: 'Understood',
            onConfirm: () => setConfirmDialog(null),
          });
          break;
        }
      }
    },
    [market.signal, engine.kill_switch, activeSymbol]
  );

  // Stable modal callbacks to preserve memoization across child components
  const handleOpenModal = useCallback(
    (modal: 'bridge' | 'settings' | 'closed_trades' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa' | 'webhook') => {
      setActiveModal(modal);
    },
    []
  );
  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
  }, []);
  const handleOpenBridge = useCallback(() => setActiveModal('bridge'), []);
  const handleOpenTradingView = useCallback(() => setActiveModal('tradingview'), []);
  const handleOpenHelp = useCallback(() => setActiveModal('help'), []);
  const handleOpenClosedTrades = useCallback(() => setActiveModal('closed_trades'), []);

  // Full snapshot only evaluated when RiskSettingsModal is actively open
  const snapshot: TerminalSnapshot | null = useMemo(() => {
    if (activeModal !== 'settings') return null;
    return tradingEngine.getSnapshot();
  }, [activeModal, ticker, market, positionsState, engine]);

  // Daily loss circuit breaker condition
  const isDailyLossExceeded =
    tradingEngine.account.daily_loss_hit ||
    tradingEngine.account.daily_drawdown_pct >= tradingEngine.account.max_daily_loss_pct;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors antialiased min-w-0">
      {/* 1. Persistent Kill Switch Banner (visible when armed) */}
      <KillSwitchBanner />

      {/* 2. Daily Loss Circuit Breaker Amber Banner */}
      {isDailyLossExceeded && (
        <div
          role="alert"
          className="w-full bg-amber-500 text-black px-4 py-2 font-mono text-xs font-bold flex items-center justify-between shrink-0 shadow-md sticky top-0 z-40"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-black shrink-0" />
            <span>
              Daily loss limit reached ({tradingEngine.account.daily_drawdown_pct.toFixed(1)}% /{' '}
              {tradingEngine.account.max_daily_loss_pct.toFixed(1)}%) — trading disabled
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-mono">Circuit Breaker Active</span>
        </div>
      )}

      {/* 3. Weekend Interbank Schedule Banner (only active when market closed) */}
      <WeekendMarketBanner onOpenMt5Modal={handleOpenBridge} />

      {/* 4. Institutional Top Navigation Header */}
      <HeaderView
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenModal={handleOpenModal}
        onToggleKillSwitchPrompt={handleRequestKillSwitchToggle}
      />

      {/* 5. Minimal Focused Terminal Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-6 py-4 space-y-4 min-w-0">
        <WorkspaceErrorBoundary>
          {/* Utilities Bar (Single row: Auto-Trade, Kill Switch, Audio, Risk, MT5, Alerts) */}
          <TerminalUtilitiesBar
            onOpenModal={handleOpenModal}
            onToggleKillSwitchPrompt={handleRequestKillSwitchToggle}
          />

          {/* Primary Split Trading Desk: Chart (8 cols) + Execution Deck (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-w-0">
            {/* Left 8 Cols: Dual Chart Workstation */}
            <div className="lg:col-span-8 bg-white dark:bg-[#0c0d12] border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs min-w-0">
              <TradingViewWidget
                isDark={isDark}
                symbol={instrumentCfg.tvSymbol}
                interval="1"
                height={540}
                onExpand={handleOpenTradingView}
                onOpenHelp={handleOpenHelp}
              />
            </div>

            {/* Right 4 Cols: 1-Click Execution & Strategy Signal Deck */}
            <div className="lg:col-span-4 min-w-0">
              <SignalEngineCard onExecuteSignal={handleExecuteSignal} />
            </div>
          </div>

          {/* Live Running Trades & Positions HUD */}
          <div className="min-w-0">
            <RunningTradesHUD
              onOpenTradeStation={handleOpenClosedTrades}
            />
          </div>
        </WorkspaceErrorBoundary>
      </main>

      {/* 6. Floating Sniper Entry Beacon / Toast Notification */}
      <SignalToastNotification onExecuteSignal={handleExecuteSignal} />

      {/* 7. Institutional Footer */}
      <FooterView />

      {/* 8. Confirmation Dialog for Critical Safety Actions */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={true}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel}
          isDestructive={confirmDialog.isDestructive}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* 9. Lazy-loaded Modals */}
      <Suspense fallback={null}>
        {activeModal === 'bridge' && (
          <Mt5BridgeModal isOpen={true} onClose={handleCloseModal} />
        )}
        {activeModal === 'settings' && snapshot && (
          <RiskSettingsModal
            isOpen={true}
            onClose={handleCloseModal}
            snapshot={snapshot}
          />
        )}
        {activeModal === 'closed_trades' && (
          <ClosedTradesModal isOpen={true} onClose={handleCloseModal} />
        )}
        {activeModal === 'daily_report' && (
          <DailyReportModal
            isOpen={true}
            onClose={handleCloseModal}
            selectedDate={reportDate}
          />
        )}
        {activeModal === 'tradingview' && (
          <TradingViewModal
            isOpen={true}
            onClose={handleCloseModal}
            isDark={isDark}
          />
        )}
        {activeModal === 'help' && (
          <HelpCenterModal
            isOpen={true}
            onClose={handleCloseModal}
            onOpenBridge={handleOpenBridge}
          />
        )}
        {activeModal === 'phone_pwa' && (
          <MobileServerModal isOpen={true} onClose={handleCloseModal} />
        )}
        {activeModal === 'webhook' && (
          <WebhookSettingsModal isOpen={true} onClose={handleCloseModal} />
        )}
      </Suspense>
    </div>
  );
}

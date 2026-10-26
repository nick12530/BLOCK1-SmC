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
  useScannerAnalyses,
  useSignalValidations,
} from './hooks/useTradingStore';
import { tradingEngine } from './engine/tradingEngine';
import { mt5Bridge } from './engine/mt5Bridge';
import { SupportedSymbol, INSTRUMENTS } from './engine/instrumentConfig';
import { Signal, TerminalSnapshot } from './types/smc';
import type { PairAnalysis } from './engine/multiPairScanner';
import { localDayKey } from './engine/tradeJournal';

// Layout & Safety Components
import { HeaderView } from './components/HeaderView';
import { KillSwitchBanner } from './components/KillSwitchBanner';
import { WeekendMarketBanner } from './components/WeekendMarketBanner';
import { FooterView } from './components/FooterView';
import { ConfirmDialog } from './components/ConfirmDialog';
import { WorkspaceErrorBoundary } from './components/ErrorBoundary';

// Control Bar & Multi-Pair Scanner Deck
import { TerminalUtilitiesBar } from './components/TerminalUtilitiesBar';
import { PairsSignalDeck } from './components/PairsSignalDeck';

// Core Charting & Execution
import { TradingViewWidget } from './components/TradingViewWidget';
import { SignalEngineCard } from './components/SignalEngineCard';
import { RunningTradesHUD } from './components/RunningTradesHUD';
import { SignalQualityCard } from './components/SignalQualityCard';

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
  const scannerAnalyses = useScannerAnalyses();
  const signalValidations = useSignalValidations();

  const activeSymbol = (ticker.symbol || 'XAUUSD') as SupportedSymbol;
  const instrumentCfg = INSTRUMENTS[activeSymbol] || INSTRUMENTS.XAUUSD;

  // Active modal
  const [activeModal, setActiveModal] = useState<
    'bridge' | 'settings' | 'closed_trades' | 'daily_report' | 'tradingview' | 'help' | 'webhook' | null
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

  // MT5 Bridge event listeners
  useEffect(() => {
    mt5Bridge.setCallback((snapshot) => tradingEngine.syncMt5Snapshot(snapshot));
    mt5Bridge.setClosedTradesCallback((trades) => tradingEngine.syncMt5ClosedTrades(trades));
    mt5Bridge.setEconomicCalendarCallback((events) => tradingEngine.syncEconomicCalendar(events));
    mt5Bridge.setConnectionChangeCallback((connected, error) =>
      tradingEngine.setMt5BridgeConnectionStatus(connected, error)
    );

    void mt5Bridge.autoConnectIfSaved().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      tradingEngine.slog(`Saved MT5 connection could not be restored: ${message}`, 'warn');
    });
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
    (customVolume?: number, positionCount?: number, signal?: Signal, symbol?: SupportedSymbol) => {
      const sig = signal || market.signal;
      if (!sig) return;
      const executionSymbol = symbol || activeSymbol;
      const signalCreatedAt = Date.parse(sig.timestamp);
      const fallbackValidityMs = sig.timeframe === 'M15' ? 15 * 60_000 : sig.timeframe === 'M5' ? 5 * 60_000 : 90_000;
      const expiresAt = sig.expiryTimestamp ?? signalCreatedAt + fallbackValidityMs;
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        setConfirmDialog({
          title: 'Signal Entry Window Expired',
          message: 'This setup has passed its valid entry window. Wait for a fresh signal before trading.',
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

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
      if (typeof customVolume !== 'number' || !Number.isFinite(customVolume) || customVolume <= 0) {
        const sizing = tradingEngine.getRiskSizingInfo(sig.sl, sig.direction, executionSymbol);
        setConfirmDialog({
          title: sizing ? 'Broker Minimum Exceeds Risk Budget' : 'Broker Sizing Data Unavailable',
          message: sizing
            ? `The broker minimum (${sizing.minimumLot} lots) would risk about $${sizing.minimumLotRisk.toFixed(2)}, above your ${sizing.riskPercent}% risk budget of $${sizing.riskBudget.toFixed(2)}. No order was sent.`
            : 'A fresh broker quote or symbol specification is unavailable, so a safe volume cannot be verified. No order was sent.',
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }
      const vol = customVolume;
      if (executionSymbol !== activeSymbol) {
        tradingEngine.switchSymbol(executionSymbol);
      }

      for (let i = 0; i < count; i++) {
        const res = tradingEngine.sendMarket(
          sig.direction,
          vol,
          sig.sl,
          sig.tp,
          sig.strategy,
          executionSymbol
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
    (modal: 'bridge' | 'settings' | 'closed_trades' | 'daily_report' | 'tradingview' | 'help' | 'webhook') => {
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

  const handleSelectSymbol = useCallback((symbol: SupportedSymbol) => {
    tradingEngine.switchSymbol(symbol);
  }, []);

  const handleExecuteAnalysis = useCallback(
    (analysis: PairAnalysis) => {
      if (analysis.status !== 'READY' || analysis.bias === 'WAITING' || !analysis.signal) return;
      if (typeof analysis.safeLotSize !== 'number' || analysis.safeLotSize <= 0) {
        setConfirmDialog({
          title: 'Risk Limit Blocks This Setup',
          message: 'No broker-valid lot size fits the current risk budget for this stop. The broker minimum would risk more than allowed, so the order was not sent.',
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }
      handleExecuteSignal(analysis.safeLotSize, 1, analysis.signal, analysis.symbol);
    },
    [handleExecuteSignal]
  );

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
    <div className="neo-app min-h-screen text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors antialiased min-w-0">
      {/* 1. Persistent Kill Switch Banner (visible when armed) */}
      <KillSwitchBanner />

      {/* 2. Daily Loss Circuit Breaker Amber Banner */}
      {isDailyLossExceeded && (
        <div
          role="alert"
          className="w-full bg-rose-700 text-white px-4 py-2 font-mono text-xs font-bold flex items-center justify-between shrink-0 shadow-md sticky top-0 z-40"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-white shrink-0" />
            <span>
              Daily loss limit reached ({tradingEngine.account.daily_drawdown_pct.toFixed(1)}% /{' '}
              {tradingEngine.account.max_daily_loss_pct.toFixed(1)}%) — trading disabled
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-mono">Circuit Breaker Active</span>
        </div>
      )}

      {/* 3. Weekend Interbank Schedule Banner (only active when market closed) */}
      <WeekendMarketBanner />

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
          {/* Essential safety and sound controls */}
          <TerminalUtilitiesBar
            onToggleKillSwitchPrompt={handleRequestKillSwitchToggle}
          />

          {/* Multi-Pair Signals & Confluence Deck (4 Instruments) */}
          <PairsSignalDeck
            scannerAnalyses={scannerAnalyses}
            activeSymbol={activeSymbol}
            onSelectSymbol={handleSelectSymbol}
            onExecuteTrade={handleExecuteAnalysis}
          />

          {/* Live Running Trades & Positions HUD */}
          <div className="min-w-0">
            <RunningTradesHUD
              onOpenTradeStation={handleOpenClosedTrades}
            />
          </div>

          {/* Primary Trading Desk: keep the chart between execution and health diagnostics */}
          <div className="flex flex-col gap-4 min-w-0">
            <div className="w-full min-w-0">
              <SignalEngineCard onExecuteSignal={handleExecuteSignal} />
            </div>

            <div className="neo-panel w-full border rounded-2xl overflow-hidden min-w-0">
              <TradingViewWidget
                isDark={isDark}
                symbol={instrumentCfg.tvSymbol}
                interval="1"
                height={460}
                onExpand={handleOpenTradingView}
                onOpenHelp={handleOpenHelp}
              />
            </div>
          </div>

          <SignalQualityCard
            ticker={ticker}
            market={market}
            analyses={scannerAnalyses}
            closedTrades={positionsState.closedTrades}
            positions={positionsState.positions}
            pendingOrders={positionsState.pendingOrders || []}
            validations={signalValidations}
          />

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
        {activeModal === 'webhook' && (
          <WebhookSettingsModal isOpen={true} onClose={handleCloseModal} />
        )}
      </Suspense>
    </div>
  );
}

/**
 * App.tsx - Institutional-Grade SMC Gold Trading Dashboard
 * Matches target 3-card layout (image.png), implements useSyncExternalStore,
 * safety ErrorBoundary, KillSwitchBanner, audio notification chimes,
 * daily report compiled summary, and confirmed execution gates.
 */

import React, { useState, useCallback } from 'react';
import { useTheme } from './hooks/useTheme';
import { useTicker, useMarket, usePositions, useEngine, useScenario } from './hooks/useTradingStore';
import { tradingEngine, MAX_SPREAD_POINTS } from './engine/tradingEngine';

import { HeaderView } from './components/HeaderView';
import { KillSwitchBanner } from './components/KillSwitchBanner';
import { WorkspaceErrorBoundary } from './components/ErrorBoundary';
import { ConfirmDialog } from './components/ConfirmDialog';

import { SignalEngineCard } from './components/SignalEngineCard';
import { DealingRangeZonesCard } from './components/DealingRangeZonesCard';
import { PositionsEventLogCard } from './components/PositionsEventLogCard';
import { MinimalEngineStatus } from './components/MinimalEngineStatus';

import { Mt5BridgeModal } from './components/Mt5BridgeModal';
import { RiskSettingsModal } from './components/RiskSettingsModal';
import { ReplayScenariosModal } from './components/ReplayScenariosModal';
import { ClosedTradesModal } from './components/ClosedTradesModal';
import { DailyReportModal } from './components/DailyReportModal';
import { TradingViewModal } from './components/TradingViewModal';
import { TradingViewWidget } from './components/TradingViewWidget';
import { HelpCenterModal } from './components/HelpCenterModal';
import { FooterView } from './components/FooterView';
import { StartupLoadingScreen } from './components/StartupLoadingScreen';
import { SignalToastNotification } from './components/SignalToastNotification';

export default function App() {
  const { isDark, toggleTheme } = useTheme();
  const [isStarted, setIsStarted] = useState(false);

  // Fine-grained channel hooks via useSyncExternalStore (Priority 1 & 2)
  const ticker = useTicker();
  const market = useMarket();
  const positionsState = usePositions();
  const engine = useEngine();
  const scenario = useScenario();

  // Discriminated modal state (Priority 4, Item 12)
  const [activeModal, setActiveModal] = useState<
    'bridge' | 'settings' | 'scenarios' | 'closed_trades' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa' | null
  >(null);

  // Safety Confirmation Dialog state (Priority 3, Item 8)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Close position handler with confirm
  const handleClosePosition = useCallback((ticket: number) => {
    tradingEngine.closePosition(ticket, 'Manual');
  }, []);

  // Execute signal with multiple position support (up to 10)
  const handleExecuteSignal = useCallback(
    (customVolume?: number) => {
      if (ticker.spread > MAX_SPREAD_POINTS) {
        setConfirmDialog({
          title: 'High Spread Warning',
          message: `Execution paused: Current spread is ${ticker.spread} points (Max allowed: ${MAX_SPREAD_POINTS} points). Protect your account from execution slippage.`,
          confirmLabel: 'Dismiss',
          isDestructive: false,
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      if (positionsState.positions.length >= 10) {
        setConfirmDialog({
          title: 'Maximum Position Limit Reached',
          message:
            'You have 10 active positions open. Close an active position or wait for Take Profit / Stop Loss before opening additional trades.',
          confirmLabel: 'Understood',
          isDestructive: false,
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      tradingEngine.tradeSignal(customVolume);
    },
    [ticker.spread, positionsState.positions.length]
  );

  // Kill switch toggle with disarm confirm (Priority 3, Item 8c)
  const handleToggleKillSwitchPrompt = useCallback(() => {
    if (engine.kill_switch) {
      // Prompt before flipping kill switch OFF
      setConfirmDialog({
        title: 'Disarm Emergency Kill Switch?',
        message: 'Disarming the Kill Switch will re-enable manual orders and automated SMC trading. Verify broker spreads and news events before proceeding.',
        confirmLabel: 'Disarm Kill Switch',
        isDestructive: false,
        onConfirm: () => {
          tradingEngine.toggleKillSwitch();
          setConfirmDialog(null);
        },
      });
    } else {
      // Arming is instant
      tradingEngine.toggleKillSwitch();
    }
  }, [engine.kill_switch]);

  if (!isStarted) {
    return (
      <StartupLoadingScreen
        onStartTrading={() => setIsStarted(true)}
        spotPrice={ticker.bid}
        balance={ticker.balance}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#080a0f] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-blue-500/30 selection:text-white">
      {/* 1. Persistent Kill Switch Banner (Priority 3, Item 7 - Outside ErrorBoundary) */}
      <KillSwitchBanner />

      {/* Subtle Non-Disruptive Signal Toast Notification */}
      <SignalToastNotification />

      {/* 2. Top Header matching image.png with session indicators & audio alert */}
      <HeaderView
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenModal={(modal) => setActiveModal(modal)}
        onToggleKillSwitchPrompt={handleToggleKillSwitchPrompt}
      />

      {/* 3. Main Workspace wrapped in ErrorBoundary (Priority 3, Item 6) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-3.5 sm:px-5 sm:py-5 lg:px-6 lg:py-6 space-y-4 sm:space-y-5">
        <WorkspaceErrorBoundary>
          {/* Target 3-Column Cards Grid - Optimized for mobile & desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-5 items-stretch">
            {/* CARD 1: SIGNAL ENGINE */}
            <SignalEngineCard onExecuteSignal={handleExecuteSignal} />

            {/* CARD 2: DEALING RANGE & LIVE ZONES */}
            <DealingRangeZonesCard />

            {/* CARD 3: POSITIONS & EVENT LOG */}
            <PositionsEventLogCard
              onClosePosition={handleClosePosition}
              onOpenClosedTradesModal={() => setActiveModal('closed_trades')}
              onOpenDailyReportModal={() => setActiveModal('daily_report')}
            />
          </div>

          {/* Primary TradingView Workstation with Dynamic M1/M5 SMC Overlay */}
          <TradingViewWidget
            isDark={isDark}
            symbol="OANDA:XAUUSD"
            interval="1"
            height={460}
            onExpand={() => setActiveModal('tradingview')}
            onOpenHelp={() => setActiveModal('help')}
          />

          {/* Institutional SMC Strategy Execution Rules (No AI Glowing Lights) */}
          <MinimalEngineStatus
            snapshot={tradingEngine.getSnapshot()}
            onOpenBridge={() => setActiveModal('bridge')}
            onOpenSettings={() => setActiveModal('settings')}
          />
        </WorkspaceErrorBoundary>
      </main>

      {/* Safety Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={true}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          isDestructive={confirmDialog.isDestructive}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Discriminated Modals (Priority 4, Item 12 - only one open at a time) */}
      <Mt5BridgeModal
        isOpen={activeModal === 'bridge'}
        onClose={() => setActiveModal(null)}
      />

      <RiskSettingsModal
        isOpen={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        snapshot={tradingEngine.getSnapshot()}
      />

      <ReplayScenariosModal
        isOpen={activeModal === 'scenarios'}
        onClose={() => setActiveModal(null)}
        currentScenario={scenario}
      />

      <ClosedTradesModal
        isOpen={activeModal === 'closed_trades'}
        onClose={() => setActiveModal(null)}
      />

      <DailyReportModal
        isOpen={activeModal === 'daily_report'}
        onClose={() => setActiveModal(null)}
      />

      <TradingViewModal
        isOpen={activeModal === 'tradingview'}
        onClose={() => setActiveModal(null)}
        isDark={isDark}
      />

      <HelpCenterModal
        isOpen={activeModal === 'help' || activeModal === 'phone_pwa'}
        initialTab={activeModal === 'phone_pwa' ? 'phone_pwa' : 'valid_signals'}
        onClose={() => setActiveModal(null)}
        onOpenBridge={() => setActiveModal('bridge')}
      />

      {/* Institutional Footer Bar */}
      <FooterView onOpenModal={(modal) => setActiveModal(modal)} />
    </div>
  );
}

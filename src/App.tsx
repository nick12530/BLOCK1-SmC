/**
 * App.tsx - Institutional-Grade SMC Gold Trading Dashboard
 * Matches target 3-card layout (image.png), implements useSyncExternalStore,
 * safety ErrorBoundary, KillSwitchBanner, audio notification chimes,
 * daily report compiled summary, and confirmed execution gates.
 */

import React, { Suspense, lazy, useState, useCallback, useEffect } from 'react';
import { useTheme } from './hooks/useTheme';
import { useTicker, useMarket, usePositions, useEngine, useScenario } from './hooks/useTradingStore';
import { tradingEngine, MAX_SPREAD_POINTS } from './engine/tradingEngine';

import { HeaderView } from './components/HeaderView';
import { KillSwitchBanner } from './components/KillSwitchBanner';
import { WorkspaceErrorBoundary } from './components/ErrorBoundary';
import { ConfirmDialog } from './components/ConfirmDialog';

import { SignalEngineCard } from './components/SignalEngineCard';
import { DealingRangeZonesCard } from './components/DealingRangeZonesCard';
import { CompoundingLadderCard } from './components/CompoundingLadderCard';
import { LiveExecutionCard } from './components/LiveExecutionCard';
import { OrderBlocksProgressionCard } from './components/OrderBlocksProgressionCard';
import { WeekendMarketBanner } from './components/WeekendMarketBanner';
import { TerminalUtilitiesBar } from './components/TerminalUtilitiesBar';
import { DailyPnLCalendarCard } from './components/DailyPnLCalendarCard';
import { TradingViewWidget } from './components/TradingViewWidget';
import { FooterView } from './components/FooterView';
import { SignalToastNotification } from './components/SignalToastNotification';
import { mt5Bridge } from './engine/mt5Bridge';
import { RISK_CONFIG } from './engine/riskConfig';
import {
  buildSignalRationale,
  findCorrespondingOrderBlock,
  localDayKey,
} from './engine/tradeJournal';

const Mt5BridgeModal = lazy(() =>
  import('./components/Mt5BridgeModal').then((module) => ({ default: module.Mt5BridgeModal }))
);
const RiskSettingsModal = lazy(() =>
  import('./components/RiskSettingsModal').then((module) => ({ default: module.RiskSettingsModal }))
);
const ReplayScenariosModal = lazy(() =>
  import('./components/ReplayScenariosModal').then((module) => ({ default: module.ReplayScenariosModal }))
);
const ClosedTradesModal = lazy(() =>
  import('./components/ClosedTradesModal').then((module) => ({ default: module.ClosedTradesModal }))
);
const DailyReportModal = lazy(() =>
  import('./components/DailyReportModal').then((module) => ({ default: module.DailyReportModal }))
);
const TradingViewModal = lazy(() =>
  import('./components/TradingViewModal').then((module) => ({ default: module.TradingViewModal }))
);
const HelpCenterModal = lazy(() =>
  import('./components/HelpCenterModal').then((module) => ({ default: module.HelpCenterModal }))
);

export default function App() {
  const { isDark, toggleTheme } = useTheme();

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
  const [reportDate, setReportDate] = useState(() => localDayKey(new Date()));

  // Safety Confirmation Dialog state (Priority 3, Item 8)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    mt5Bridge.setCallback((snapshot) => tradingEngine.syncMt5Snapshot(snapshot));
    mt5Bridge.setClosedTradesCallback((trades) => tradingEngine.syncMt5ClosedTrades(trades));
  }, []);

  // Execute signal with multiple position support (up to 10)
  const handleExecuteSignal = useCallback(
    async (customVolume?: number, positionCount: number = 1) => {
      const signal = tradingEngine.getMarketSnapshot().signal;
      if (!signal) {
        setConfirmDialog({
          title: 'No confirmed setup',
          message: 'No signal currently meets the strategy filters. Wait for a confirmed setup; manual directional orders are disabled.',
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      if (engine.kill_switch) {
        setConfirmDialog({
          title: 'Kill Switch Armed',
          message: 'The Kill Switch is armed. No trade can be sent until it is deliberately disarmed.',
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      const gateReason = tradingEngine.getEntryBlockReason(signal.direction, signal);
      if (gateReason) {
        setConfirmDialog({
          title: 'Trade blocked by risk controls',
          message: gateReason,
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      const riskVolume = tradingEngine.getRiskBasedVolume(signal.sl, customVolume);
      if (!riskVolume) {
        setConfirmDialog({
          title: 'Safe position size unavailable',
          message: 'The configured risk cannot be converted to a valid broker lot size for this stop. Check the MT5 symbol tick value and volume limits.',
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

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

      if (positionCount !== 1 || positionsState.positions.length + positionCount > RISK_CONFIG.maxOpenPositions) {
        setConfirmDialog({
          title: 'Signal stacking is disabled',
          message: `One position per qualified signal is allowed, with a maximum of ${RISK_CONFIG.maxOpenPositions} open positions. You currently have ${positionsState.positions.length}.`,
          confirmLabel: 'Understood',
          isDestructive: false,
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      if (tradingEngine.mt5Account.connected && !mt5Bridge.getStatus().connected) {
        setConfirmDialog({
          title: 'MT5 bridge unavailable',
          message: 'The linked MT5 bridge is offline. No order was sent. Reconnect the bridge before trying again.',
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      if (mt5Bridge.getStatus().connected) {
        const rationale = buildSignalRationale(signal);
        const strategyOrderBlock = findCorrespondingOrderBlock(
          signal.direction,
          signal.entry,
          tradingEngine.getMarketSnapshot().zones
        );
        for (let index = 0; index < positionCount; index += 1) {
          try {
            const result = await mt5Bridge.sendTrade({
              direction: signal.direction,
              volume: riskVolume,
              symbol: mt5Bridge.getSymbol(),
              sl: signal.sl,
              tp: signal.tp,
              rationale,
              clientOrderId: `${signal.timeframe}:${signal.direction}:${signal.timestamp}:${signal.entry.toFixed(2)}`,
              poiKey: tradingEngine.getSignalPoiKey(signal.direction, signal.entry),
              signalTimeframe: signal.timeframe === 'M1' ? 'M1' : 'M5',
              signalTimestamp: signal.timestamp,
            });
            tradingEngine.recordMt5Rationale(
              result.ticket,
              result.positionTicket,
              rationale,
              strategyOrderBlock
            );
            tradingEngine.recordAcceptedEntry(signal.direction, signal);
            tradingEngine.slog(
              result.pending
                ? `MT5 order placed but not confirmed filled: #${result.ticket} · ${result.filledVolume} lots reported. Verify it in MT5.`
                : result.partial
                ? `MT5 order partially filled: #${result.ticket} ${signal.direction} ${result.filledVolume} lots @ ${result.price}. Verify remaining quantity.`
                : `MT5 order filled: #${result.ticket} ${signal.direction} ${result.filledVolume} lots @ ${result.price} · ${rationale}`,
              result.pending || result.partial ? 'warn' : 'trade'
            );
          } catch (error) {
            const reason = error instanceof Error ? error.message : 'Unknown MT5 bridge error.';
            tradingEngine.slog(`MT5 order rejected: ${reason}`, 'error');
            setConfirmDialog({
              title: 'MT5 order rejected',
              message: `Order ${index + 1} of ${positionCount} was not sent: ${reason}`,
              confirmLabel: 'Understood',
              onConfirm: () => setConfirmDialog(null),
            });
            return;
          }
        }
        return;
      }

      if (positionCount > 1) {
        tradingEngine.tradeMultiplePositions(positionCount, customVolume);
      } else {
        tradingEngine.tradeSignal(customVolume);
      }
    },
    [ticker.spread, positionsState.positions.length, engine.kill_switch]
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#08111a] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-sky-500/30 selection:text-white">
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
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-6">
        <WorkspaceErrorBoundary>
          <WeekendMarketBanner onOpenMt5Modal={() => setActiveModal('bridge')} />

          <section aria-label="System controls" className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">System controls</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Connection, automation, alerts, and safeguards</p>
            </div>
            <TerminalUtilitiesBar
              onOpenModal={(modal) => setActiveModal(modal)}
              onToggleKillSwitchPrompt={handleToggleKillSwitchPrompt}
            />
          </section>

          <section aria-label="Trading parameters" className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Trade parameters</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Position sizing and break-even preferences</p>
            </div>
            <CompoundingLadderCard />
          </section>

          <section aria-label="Trade signals" className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Trade signals</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Only confirmed setups are eligible for execution</p>
            </div>
            <SignalEngineCard onExecuteSignal={handleExecuteSignal} />
          </section>

          <section aria-label="FX chart" className="w-full space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Price &amp; structure</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">One price scale for broker candles, SMC zones, structure, and execution levels</p>
            </div>
            <TradingViewWidget
              isDark={isDark}
              symbol="OANDA:XAUUSD"
              interval="1"
              height={460}
              onExpand={() => setActiveModal('tradingview')}
              onOpenHelp={() => setActiveModal('help')}
            />
          </section>

          <section aria-label="Open positions" className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Open positions</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Select an open trade to focus it and its order block on the chart</p>
            </div>
            <LiveExecutionCard
              onFocusChart={() =>
                document
                  .getElementById('price-structure-chart')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
              onOpenClosedTradesModal={() => setActiveModal('closed_trades')}
              onOpenDailyReportModal={() => setActiveModal('daily_report')}
            />
          </section>

          <section aria-label="Market context" className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Market context</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Dealing range, active zones, and order-block status</p>
            </div>
            <div className="flex flex-col gap-4">
              <DealingRangeZonesCard />
              <OrderBlocksProgressionCard />
            </div>
          </section>

          <DailyPnLCalendarCard
            onOpenJournal={(date) => {
              setReportDate(date);
              setActiveModal('daily_report');
            }}
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
      {activeModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[150] grid place-items-center bg-black/40">
              <p role="status" className="rounded-lg bg-white px-4 py-3 text-sm text-slate-700 shadow-xl dark:bg-zinc-900 dark:text-zinc-200">
                Loading panel…
              </p>
            </div>
          }
        >
          {activeModal === 'bridge' && (
            <Mt5BridgeModal isOpen onClose={() => setActiveModal(null)} />
          )}
          {activeModal === 'settings' && (
            <RiskSettingsModal
              isOpen
              onClose={() => setActiveModal(null)}
              snapshot={tradingEngine.getSnapshot()}
            />
          )}
          {activeModal === 'scenarios' && (
            <ReplayScenariosModal
              isOpen
              onClose={() => setActiveModal(null)}
              currentScenario={scenario}
            />
          )}
          {activeModal === 'closed_trades' && (
            <ClosedTradesModal isOpen onClose={() => setActiveModal(null)} />
          )}
          {activeModal === 'daily_report' && (
            <DailyReportModal
              isOpen
              selectedDate={reportDate}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === 'tradingview' && (
            <TradingViewModal
              isOpen
              onClose={() => setActiveModal(null)}
              isDark={isDark}
            />
          )}
          {(activeModal === 'help' || activeModal === 'phone_pwa') && (
            <HelpCenterModal
              isOpen
              initialTab={activeModal === 'phone_pwa' ? 'phone_pwa' : 'valid_signals'}
              onClose={() => setActiveModal(null)}
              onOpenBridge={() => setActiveModal('bridge')}
            />
          )}
        </Suspense>
      )}

      {/* Institutional Footer Bar */}
      <FooterView />
    </div>
  );
}

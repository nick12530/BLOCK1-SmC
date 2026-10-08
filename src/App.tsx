/**
 * App.tsx - Institutional-Grade SMC Gold Trading Dashboard
 * Matches target 3-card layout (image.png), implements useSyncExternalStore,
 * safety ErrorBoundary, KillSwitchBanner, audio notification chimes,
 * daily report compiled summary, and confirmed execution gates.
 */

import React, { Suspense, lazy, useState, useCallback, useEffect } from 'react';
import { useTheme } from './hooks/useTheme';
import {
  useTicker,
  useMarket,
  usePositions,
  useEngine,
  useScannerAnalyses,
  useBestOpportunity,
} from './hooks/useTradingStore';
import { tradingEngine } from './engine/tradingEngine';

import { HeaderView } from './components/HeaderView';
import { KillSwitchBanner } from './components/KillSwitchBanner';
import { WorkspaceErrorBoundary } from './components/ErrorBoundary';
import { ConfirmDialog } from './components/ConfirmDialog';

import { MultiPairScannerPanel } from './components/MultiPairScannerPanel';
import { BestOpportunityCard } from './components/BestOpportunityCard';
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
import { StartupLoadingScreen } from './components/StartupLoadingScreen';
import { mt5Bridge } from './engine/mt5Bridge';
import { RISK_CONFIG } from './engine/riskConfig';
import type { Signal } from './types/smc';
import type { SupportedSymbol } from './engine/instrumentConfig';
import { getInstrumentConfig } from './engine/instrumentConfig';
import type { PairAnalysis } from './engine/multiPairScanner';
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
  const scannerAnalyses = useScannerAnalyses();
  const bestOpportunity = useBestOpportunity();

  const handleSelectSymbol = useCallback((symbol: SupportedSymbol) => {
    tradingEngine.switchSymbol(symbol);
  }, []);

  // Discriminated modal state (Priority 4, Item 12)
  const [activeModal, setActiveModal] = useState<
    'bridge' | 'settings' | 'closed_trades' | 'daily_report' | 'tradingview' | 'help' | 'phone_pwa' | null
  >(null);
  const [reportDate, setReportDate] = useState(() => localDayKey(new Date()));
  const [showStartupScreen, setShowStartupScreen] = useState(true);
  const [autoConnectChecked, setAutoConnectChecked] = useState(false);

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
    mt5Bridge.setConnectionChangeCallback((connected, error) => {
      if (!connected) tradingEngine.setMt5BridgeConnectionStatus(false, error);
    });
    void mt5Bridge.autoConnectIfSaved()
      .catch((error: unknown) => {
        tradingEngine.slog(
          `Saved MT5 reconnect failed: ${error instanceof Error ? error.message : 'Unknown bridge error'}`,
          'warn'
        );
      })
      .finally(() => setAutoConnectChecked(true));
  }, []);

  // Route one explicitly confirmed signal order to the connected MT5 account.
  const handleExecuteSignal = useCallback(
    async (
      customVolume?: number,
      positionCount: number = 1,
      selectedSignal?: Signal,
      confirmedVolume?: number
    ) => {
      const signal = selectedSignal ?? tradingEngine.getMarketSnapshot().signal;
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

      const riskVolume = tradingEngine.getRiskBasedVolume(signal.sl, customVolume, signal.direction);
      if (!riskVolume) {
        setConfirmDialog({
          title: 'Safe position size unavailable',
          message: tradingEngine.getRiskSizingFailureReason(signal.sl, customVolume, signal.direction),
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      if (confirmedVolume !== undefined && Math.abs(riskVolume - confirmedVolume) > 1e-8) {
        const entry = signal.direction === 'BUY' ? ticker.ask : ticker.bid;
        setConfirmDialog({
          title: 'Quote or safe volume changed',
          message: `No order was sent because the broker quote changed after your confirmation. The current ${signal.direction} ${ticker.symbol} quote is approximately ${entry}, and the recalculated safe size is ${riskVolume} lots. Review and submit again to confirm these updated details.`,
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      const maxSpreadPoints = tradingEngine.getMaxSpreadPoints();
      if (ticker.spread > maxSpreadPoints) {
        setConfirmDialog({
          title: 'High Spread Warning',
          message: `Execution paused: Current spread is ${ticker.spread} points (maximum: ${maxSpreadPoints}). Protect your account from execution slippage.`,
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

      if (!mt5Bridge.getStatus().connected) {
        setConfirmDialog({
          title: 'MT5 is not connected',
          message: 'No broker order was sent. Connect to the intended MT5 account and wait for its broker quote to sync. Disconnected dashboard orders are not sent to a broker.',
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      const rationale = buildSignalRationale(signal);
      const strategyOrderBlock = findCorrespondingOrderBlock(
        signal.direction,
        signal.entry,
        tradingEngine.getMarketSnapshot().zones
      );
      try {
        const result = await mt5Bridge.sendTrade({
          direction: signal.direction,
          volume: riskVolume,
          symbol: mt5Bridge.getSymbol(),
          sl: signal.sl,
          tp: signal.tp,
          rationale,
          clientOrderId: `${signal.strategy}:${signal.timeframe}:${signal.direction}:${signal.timestamp}:${signal.entry.toFixed(8)}`,
          poiKey: tradingEngine.getSignalPoiKey(signal.direction, signal.entry),
          instrumentType: tradingEngine.instrumentType,
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
          message: `The order was not accepted by the broker: ${reason}`,
          confirmLabel: 'Understood',
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }
    },
    [ticker.ask, ticker.bid, ticker.symbol, ticker.spread, positionsState.positions.length, engine.kill_switch]
  );

  const handleRequestExecuteSignal = useCallback(
    (customVolume?: number, positionCount: number = 1, selectedSignal?: Signal) => {
      if (!mt5Bridge.getStatus().connected) {
        void handleExecuteSignal(customVolume, positionCount, selectedSignal);
        return;
      }
      const signal = selectedSignal ?? tradingEngine.getMarketSnapshot().signal;
      if (!signal) {
        void handleExecuteSignal(customVolume, positionCount, selectedSignal);
        return;
      }
      const volume = tradingEngine.getRiskBasedVolume(signal.sl, customVolume, signal.direction);
      if (!volume) {
        void handleExecuteSignal(customVolume, positionCount, selectedSignal);
        return;
      }

      const entry = signal.direction === 'BUY' ? ticker.ask : ticker.bid;
      setConfirmDialog({
        title: `Confirm ${signal.direction} order`,
        message: `Send ${signal.direction} ${ticker.symbol} at approximately ${entry} using ${volume} lots, SL ${signal.sl}, and TP ${signal.tp} to MT5 account ${engine.mt5Account?.login ?? 'unknown'} (${engine.mt5Account?.server ?? 'unknown server'}, ${market.accountMode?.toUpperCase() ?? 'account type unknown'})? This submits a broker order. Verify the symbol, volume, and stop levels before continuing.`,
        confirmLabel: `Send ${signal.direction} order`,
        isDestructive: true,
        onConfirm: () => {
          setConfirmDialog(null);
          void handleExecuteSignal(customVolume, positionCount, signal, volume);
        },
      });
    },
    [market.accountMode, engine.mt5Account?.login, engine.mt5Account?.server, handleExecuteSignal, ticker.ask, ticker.bid, ticker.symbol]
  );

  const handleExecuteAnalysis = useCallback(
    (analysis: PairAnalysis) => {
      if (analysis.symbol !== ticker.symbol) {
        tradingEngine.switchSymbol(analysis.symbol);
      }
      if (analysis.signal) {
        handleRequestExecuteSignal(analysis.safeLotSize ?? undefined, 1, analysis.signal);
      }
    },
    [ticker.symbol, handleRequestExecuteSignal]
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
      <SignalToastNotification onExecuteSignal={handleRequestExecuteSignal} />

      {/* 2. Top Header matching image.png with session indicators & audio alert */}
      <HeaderView
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenModal={(modal) => setActiveModal(modal)}
        onToggleKillSwitchPrompt={handleToggleKillSwitchPrompt}
      />

      {/* 3. Main Workspace wrapped in ErrorBoundary (Priority 3, Item 6) */}
      <main className="mx-auto grid w-full max-w-[1920px] flex-1 grid-cols-1 items-start gap-5 px-3 py-4 sm:px-6 sm:py-6 lg:grid-cols-12 lg:gap-6 lg:px-8">
        <WorkspaceErrorBoundary>
          <div className="lg:col-span-12">
            <WeekendMarketBanner onOpenMt5Modal={() => setActiveModal('bridge')} />
          </div>

          <section aria-label="System controls" className="space-y-3 lg:col-span-12">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">System controls</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Connection, automation, alerts, and safeguards</p>
            </div>
            <TerminalUtilitiesBar
              onOpenModal={(modal) => setActiveModal(modal)}
              onToggleKillSwitchPrompt={handleToggleKillSwitchPrompt}
            />
          </section>

          {/* 1. Best Opportunity Podium Banner (Section 14) */}
          {bestOpportunity && (
            <div className="lg:col-span-12">
              <BestOpportunityCard
                rankedAnalyses={scannerAnalyses}
                onSelectSymbol={handleSelectSymbol}
                onExecuteTrade={handleExecuteAnalysis}
              />
            </div>
          )}

          {/* 2. Unified Multi-Pair Market Scanner Panel (Section 1 & 13) */}
          <section aria-label="Multi-pair scanner" className="space-y-3 lg:col-span-12">
            <MultiPairScannerPanel
              scannerAnalyses={scannerAnalyses}
              activeSymbol={ticker.symbol}
              onSelectSymbol={handleSelectSymbol}
              onExecuteTrade={handleExecuteAnalysis}
            />
          </section>

          <section aria-label="Trade signals" className="space-y-3 lg:col-span-8">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Trade signals</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Only confirmed setups are eligible for execution</p>
            </div>
            <SignalEngineCard onExecuteSignal={handleRequestExecuteSignal} />
          </section>

          <section aria-label="Trading parameters" className="space-y-3 lg:col-span-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Trade parameters</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Position sizing and break-even preferences</p>
            </div>
            <CompoundingLadderCard />
          </section>

          {/* Active Trade Block (Brought right below signals & parameters for mobile and desktop) */}
          <section aria-label="Open positions" className="space-y-3 lg:col-span-12">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Active positions &amp; live trade monitor</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Live floating P&amp;L, one-click break-even lock, and lot management</p>
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

          <section aria-label="FX chart" className="w-full space-y-3 lg:col-span-8">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Price &amp; structure workstation</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Official TradingView live charts &amp; Institutional SMC engine with indicator toggle</p>
            </div>
            <TradingViewWidget
              isDark={isDark}
              symbol={getInstrumentConfig(ticker.symbol).tvSymbol}
              interval="1"
              height={460}
              onExpand={() => setActiveModal('tradingview')}
              onOpenHelp={() => setActiveModal('help')}
            />
          </section>

          <section aria-label="Market context" className="space-y-3 lg:col-span-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Market context &amp; SMC POIs</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Dealing range, active zones, and order-block progression</p>
            </div>
            <div className="flex flex-col gap-4">
              <DealingRangeZonesCard />
              <OrderBlocksProgressionCard />
            </div>
          </section>

          <div className="lg:col-span-12">
            <DailyPnLCalendarCard
              onOpenJournal={(date) => {
                setReportDate(date);
                setActiveModal('daily_report');
              }}
            />
          </div>
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

      {showStartupScreen && (
        <StartupLoadingScreen
          onStartTrading={() => setShowStartupScreen(false)}
          spotPrice={market.brokerMarketData ? ticker.bid : null}
          balance={engine.mt5Account?.connected ? ticker.balance : null}
          connectionStatus={
            !autoConnectChecked
              ? 'checking'
              : market.brokerMarketData
                ? 'connected'
                : engine.mt5Account?.connected
                  ? 'waiting'
                : 'offline'
          }
        />
      )}
    </div>
  );
}

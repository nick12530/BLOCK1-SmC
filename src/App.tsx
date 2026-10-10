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
import { PairsSignalDeck } from './components/PairsSignalDeck';
import { BestOpportunityCard } from './components/BestOpportunityCard';
import { SignalEngineCard } from './components/SignalEngineCard';
import { DealingRangeZonesCard } from './components/DealingRangeZonesCard';
import { LiveExecutionCard } from './components/LiveExecutionCard';
import { OrderBlocksProgressionCard } from './components/OrderBlocksProgressionCard';
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
import { BarChart3, Layers, Activity } from 'lucide-react';
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
const MobileServerModal = lazy(() =>
  import('./components/MobileServerModal').then((module) => ({ default: module.MobileServerModal }))
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
  const [hasEnteredTerminal, setHasEnteredTerminal] = useState(() => {
    if (typeof window === 'undefined') return true;
    return Boolean(sessionStorage.getItem('terminal_entered'));
  });

  // Safety Confirmation Dialog state (Priority 3, Item 8)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Workspace tab to offload screen-cluttering widgets while keeping them running in background
  const [workspaceTab, setWorkspaceTab] = useState<'chart' | 'zones' | 'scanner'>('chart');

  useEffect(() => {
    mt5Bridge.setCallback((snapshot) => tradingEngine.syncMt5Snapshot(snapshot));
    mt5Bridge.setClosedTradesCallback((trades) => tradingEngine.syncMt5ClosedTrades(trades));
    mt5Bridge.setConnectionChangeCallback((connected, error) =>
      tradingEngine.setMt5BridgeConnectionStatus(connected, error)
    );
  }, []);

  // Execute signal with multiple position support (up to 10)
  const handleExecuteSignal = useCallback(
    async (customVolume?: number, positionCount: number = 1, selectedSignal?: Signal) => {
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
        mt5Bridge.setSymbol(ticker.symbol);
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
              symbol: ticker.symbol,
              sl: signal.sl,
              tp: signal.tp,
              rationale,
              clientOrderId: `${ticker.symbol}:${signal.strategy}:${signal.timeframe}:${signal.direction}:${Date.now()}`,
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
            tradingEngine.setSelectedTicket(result.ticket);
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

  const handleExecuteAnalysis = useCallback(
    (analysis: PairAnalysis) => {
      if (analysis.symbol !== ticker.symbol) {
        tradingEngine.switchSymbol(analysis.symbol);
      }
      if (analysis.signal) {
        void handleExecuteSignal(analysis.safeLotSize ?? undefined, 1, analysis.signal);
      }
    },
    [ticker.symbol, handleExecuteSignal]
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

  if (!hasEnteredTerminal) {
    return (
      <StartupLoadingScreen
        spotPrice={ticker.bid || 4185}
        balance={ticker.balance || 100}
        onStartTrading={() => {
          sessionStorage.setItem('terminal_entered', 'true');
          setHasEnteredTerminal(true);
        }}
      />
    );
  }

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
      <main className="mx-auto grid w-full max-w-[1920px] flex-1 grid-cols-1 items-start gap-2.5 sm:gap-4 lg:gap-5 px-2 py-2 sm:px-6 sm:py-5 lg:px-8">
        <WorkspaceErrorBoundary>
          {/* 1. Multi-Pair Signal Deck (Arranged right above multi-strategy deck) */}
          <section aria-label="Currency pair signals" className="space-y-2 lg:col-span-12">
            <PairsSignalDeck
              scannerAnalyses={scannerAnalyses}
              activeSymbol={ticker.symbol}
              onSelectSymbol={handleSelectSymbol}
              onExecuteTrade={handleExecuteAnalysis}
            />
          </section>

          {/* 2. Primary Signal Engine (Deterministic Verification & Execution) */}
          <section aria-label="Trade signals" className="space-y-2 lg:col-span-12">
            <SignalEngineCard onExecuteSignal={handleExecuteSignal} />
          </section>

          {/* 3. Active Trade Block (Positioned immediately below signals) */}
          <section aria-label="Open positions" className="space-y-2 lg:col-span-12">
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

          {/* 4. Decluttered Workspace Control Bar: Focused Chart vs Zones vs Background Scanner */}
          <section className="lg:col-span-12 flex items-center justify-between border-b border-slate-200/80 dark:border-[#1a3040] pb-2 flex-wrap gap-2 pt-1 font-mono text-xs">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0c141d] p-0.5 rounded-lg border border-slate-200 dark:border-[#1a3040]">
              <button
                type="button"
                onClick={() => setWorkspaceTab('chart')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  workspaceTab === 'chart'
                    ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Focused high-resolution candlestick chart with SMC overlay"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Primary Chart Terminal</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('zones')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  workspaceTab === 'zones'
                    ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Deep dive into dealing ranges, equilibrium, and order block progression"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Zones &amp; Order Blocks</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('scanner')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  workspaceTab === 'scanner'
                    ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Multi-pair scanner matrix (runs continuously in background)"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Cross-Pair Scanner Matrix</span>
              </button>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Background Scanner Engine Active (4 Pairs)</span>
            </div>
          </section>

          {/* 5. Dynamically Rendered Workstation View */}
          {workspaceTab === 'chart' && (
            <section aria-label="FX chart" className="w-full space-y-2 lg:col-span-12">
              <TradingViewWidget
                isDark={isDark}
                symbol={getInstrumentConfig(ticker.symbol).tvSymbol}
                interval="1"
                height={520}
                onExpand={() => setActiveModal('tradingview')}
                onOpenHelp={() => setActiveModal('help')}
              />
            </section>
          )}

          {workspaceTab === 'zones' && (
            <>
              <section aria-label="Dealing Range Zones" className="space-y-2 lg:col-span-6">
                <DealingRangeZonesCard />
              </section>
              <section aria-label="Order Blocks Progression" className="space-y-2 lg:col-span-6">
                <OrderBlocksProgressionCard />
              </section>
            </>
          )}

          {workspaceTab === 'scanner' && (
            <section aria-label="Multi-pair scanner" className="space-y-2 lg:col-span-12">
              <MultiPairScannerPanel
                scannerAnalyses={scannerAnalyses}
                activeSymbol={ticker.symbol}
                onSelectSymbol={handleSelectSymbol}
                onExecuteTrade={handleExecuteAnalysis}
              />
            </section>
          )}
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
          {activeModal === 'help' && (
            <HelpCenterModal
              isOpen
              initialTab="valid_signals"
              onClose={() => setActiveModal(null)}
              onOpenBridge={() => setActiveModal('bridge')}
            />
          )}
          {activeModal === 'phone_pwa' && (
            <MobileServerModal
              isOpen
              onClose={() => setActiveModal(null)}
            />
          )}
        </Suspense>
      )}

      {/* Institutional Footer Bar */}
      <FooterView />
    </div>
  );
}

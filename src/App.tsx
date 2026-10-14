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
import { WeekendMarketBanner } from './components/WeekendMarketBanner';
import { WorkspaceErrorBoundary } from './components/ErrorBoundary';
import { ConfirmDialog } from './components/ConfirmDialog';

import { PairsSignalDeck } from './components/PairsSignalDeck';
import { LiveExecutionCard } from './components/LiveExecutionCard';
import { TradingViewWidget } from './components/TradingViewWidget';
import { RunningTradesHUD } from './components/RunningTradesHUD';
import { LiveSignalsStream } from './components/LiveSignalsStream';
import { FooterView } from './components/FooterView';
import { SignalToastNotification } from './components/SignalToastNotification';
import { StartupLoadingScreen } from './components/StartupLoadingScreen';
import { mt5Bridge } from './engine/mt5Bridge';
import { useAudioNotifications } from './hooks/useAudioNotifications';
import { signalAudioNotifier } from './utils/audioNotification';
import { RISK_CONFIG } from './engine/riskConfig';
import type { Signal } from './types/smc';
import type { SupportedSymbol } from './engine/instrumentConfig';
import { getInstrumentConfig } from './engine/instrumentConfig';
import type { PairAnalysis } from './engine/multiPairScanner';
import {
  BarChart3,
  Zap,
  TrendingUp,
  TrendingDown,
  History,
} from 'lucide-react';
import { AuditJournalPanel } from './components/AuditJournalPanel';
import {
  buildSignalRationale,
  findCorrespondingOrderBlock,
  localDayKey,
  recordTradeTaken,
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

export type WorkspaceTab = 'execution' | 'chart' | 'journal';

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

  // Master workspace tab: minimalist Execution Desk vs Chart
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('execution');

  // Global audio alerts & chime listener for institutional signals
  useAudioNotifications();

  useEffect(() => {
    mt5Bridge.setCallback((snapshot) => tradingEngine.syncMt5Snapshot(snapshot));
    mt5Bridge.setClosedTradesCallback((trades) => tradingEngine.syncMt5ClosedTrades(trades));
    mt5Bridge.setConnectionChangeCallback((connected, error) =>
      tradingEngine.setMt5BridgeConnectionStatus(connected, error)
    );

    // Auto-reconnect to MT5 bridge on terminal refresh if previously linked
    void mt5Bridge.autoConnectIfSaved().catch(() => {});
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
        tradingEngine.recordRejectedSignal(signal, 'Emergency Kill Switch is armed', ticker.symbol);
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
        tradingEngine.recordRejectedSignal(signal, gateReason, ticker.symbol);
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
        tradingEngine.recordRejectedSignal(signal, 'Position sizing unavailable for current risk', ticker.symbol);
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
        tradingEngine.recordRejectedSignal(signal, `Spread too high (${ticker.spread} points > ${maxSpreadPoints} max)`, ticker.symbol);
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
        tradingEngine.recordRejectedSignal(signal, `Max open positions limit (${RISK_CONFIG.maxOpenPositions}) reached`, ticker.symbol);
        setConfirmDialog({
          title: 'Signal stacking is disabled',
          message: `One position per qualified signal is allowed, with a maximum of ${RISK_CONFIG.maxOpenPositions} open positions. You currently have ${positionsState.positions.length}.`,
          confirmLabel: 'Understood',
          isDestructive: false,
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      // If bridge is offline or in standby, automatically execute via workstation desk fill
      if (!mt5Bridge.getStatus().connected) {
        if (positionCount > 1) {
          tradingEngine.tradeMultiplePositions(positionCount, customVolume);
        } else {
          tradingEngine.tradeSignal(customVolume);
        }
        signalAudioNotifier.playTradeExecutionAlert(signal.direction);
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
              signalTimestamp: new Date().toISOString(),
            });
            tradingEngine.recordMt5Rationale(
              result.ticket,
              result.positionTicket,
              rationale,
              strategyOrderBlock
            );
            tradingEngine.setSelectedTicket(result.ticket);
            tradingEngine.recordAcceptedEntry(signal.direction, signal);
            tradingEngine.recordExecutedSignal(signal, result.ticket, riskVolume, ticker.symbol, rationale);
            recordTradeTaken({
              ticket: result.ticket,
              symbol: ticker.symbol,
              type: signal.direction,
              volume: riskVolume,
              openPrice: result.price,
              closePrice: result.price,
              openTime: new Date().toISOString(),
              sl: signal.sl,
              tp: signal.tp,
              profit: 0,
              pips: 0,
              reason: 'Manual',
              strategyRationale: rationale,
              status: 'RUNNING',
            });
            signalAudioNotifier.playTradeExecutionAlert(signal.direction);
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
            tradingEngine.recordRejectedSignal(signal, `MT5 bridge rejected: ${reason}`, ticker.symbol);
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
      signalAudioNotifier.playTradeExecutionAlert(signal.direction);
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-[#090a0f] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-sky-500/30 selection:text-white">
      {/* 1. Persistent Kill Switch Banner (Outside ErrorBoundary) */}
      <KillSwitchBanner />

      {/* Real-Time Market Reopen Countdown Banner */}
      <div className="w-full px-2.5 sm:px-6 lg:px-8 pt-1 sm:pt-2">
        <WeekendMarketBanner />
      </div>

      {/* Subtle Non-Disruptive Signal Toast Notification */}
      <SignalToastNotification />

      {/* 2. Top Header with responsive mobile layout (NO horizontal slider) */}
      <HeaderView
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenModal={(modal) => setActiveModal(modal)}
        onToggleKillSwitchPrompt={handleToggleKillSwitchPrompt}
      />

      {/* 3. Main Workspace wrapped in ErrorBoundary */}
      <main className="mx-auto w-full max-w-[1920px] flex-1 px-2.5 py-3 sm:px-6 sm:py-4.5 lg:px-8 space-y-3 sm:space-y-4 lg:space-y-5">
        <WorkspaceErrorBoundary>
          {/* Top Full-Width Deck: Multi-Pair Signal Deck (All 4 Instruments) */}
          <section aria-label="Currency pair signals" className="w-full">
            <PairsSignalDeck
              scannerAnalyses={scannerAnalyses}
              activeSymbol={ticker.symbol}
              onSelectSymbol={handleSelectSymbol}
              onExecuteTrade={handleExecuteAnalysis}
            />
          </section>

          {/* Minimalist 3-Tab Navigation Bar: Execution Desk, Live Chart & Audit Journal */}
          <div className="w-full bg-white dark:bg-[#0c0e12] border border-slate-200 dark:border-zinc-800 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 shadow-xs transition-colors">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 font-mono text-xs p-0.5 flex-wrap">
                {/* 1. Signals & Execution Desk */}
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('execution')}
                  className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                    workspaceTab === 'execution'
                      ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                  }`}
                  title="Live Signals Stream & 1-Click Execution Desk"
                >
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                  <span>Signals &amp; Execution Desk</span>
                  {positionsState.positions.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500 text-slate-950 font-black">
                      {positionsState.positions.length} Active
                    </span>
                  )}
                </button>

                {/* 2. Candlestick Chart Terminal */}
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('chart')}
                  className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                    workspaceTab === 'chart'
                      ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                  }`}
                  title="Focused High-Resolution Candlestick Chart Terminal"
                >
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  <span>Live Chart ({ticker.symbol})</span>
                </button>

                {/* 3. System Audit Journal */}
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('journal')}
                  className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                    workspaceTab === 'journal'
                      ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                  }`}
                  title="System Audit Journal: Trades Taken & Signals Logged (Executed & Rejected)"
                >
                  <History className="w-4 h-4 text-zinc-400" />
                  <span>Audit Journal</span>
                </button>
              </div>

              {/* Status indicator on the right */}
              <div className="flex items-center gap-2 text-xs font-mono pr-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-bold hidden sm:inline">
                  Continuous 4-Pair Scanner Active
                </span>
                {tradingEngine.mt5Account.connected && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 font-bold">
                    MT5 Linked
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* VIEW 1: SIGNALS & EXECUTION DESK (MINIMALIST & OPERATIONAL) */}
          {workspaceTab === 'execution' && (
            <div className="flex flex-col gap-3 sm:gap-4 w-full">
              {/* 1. Real-Time Running Trades Monitor: Clear visibility into active positions & P&L */}
              <section aria-label="Running trades monitor" className="w-full">
                <RunningTradesHUD onOpenTradeStation={() => {}} />
              </section>

              {/* 2. Live Signals Execution Queue: All signals lined up with 1-Click Execute buttons */}
              <section aria-label="Live signals queue" className="w-full">
                <LiveSignalsStream
                  onExecuteTrade={(symbol, direction, sl, tp, rationale) => {
                    tradingEngine.slog(`Signal dispatched: ${direction} 0.01L ${symbol} · ${rationale}`, 'trade');
                  }}
                />
              </section>

              {/* 3. Account Telemetry & Execution Ledger: Real-time Margin & Closed Trades History */}
              <section aria-label="Open positions and margin ledger" className="w-full">
                <LiveExecutionCard
                  onFocusChart={() => setWorkspaceTab('chart')}
                  onOpenClosedTradesModal={() => setActiveModal('closed_trades')}
                  onOpenDailyReportModal={() => setActiveModal('daily_report')}
                />
              </section>
            </div>
          )}

          {/* VIEW 2: PRIMARY CANDLESTICK CHART TERMINAL */}
          {workspaceTab === 'chart' && (
            <div className="flex flex-col gap-3 sm:gap-4 w-full">
              <section id="price-structure-chart" aria-label="FX chart" className="w-full">
                <TradingViewWidget
                  isDark={isDark}
                  symbol={getInstrumentConfig(ticker.symbol).tvSymbol}
                  interval="1"
                  height={580}
                  onExpand={() => setActiveModal('tradingview')}
                  onOpenHelp={() => setActiveModal('help')}
                />
              </section>

              {/* Quick Signal Action Ribbon below chart */}
              {market.signal && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#0c0e12] border border-slate-200 dark:border-zinc-800 font-mono text-xs flex-wrap gap-2.5 shadow-xs transition-colors">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase flex items-center gap-1 ${
                        market.signal.direction === 'BUY'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {market.signal.direction === 'BUY' ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      <span>{market.signal.direction} SIGNAL</span>
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 font-bold">
                      Entry: ${market.signal.entry.toFixed(2)} · SL: ${market.signal.sl.toFixed(2)} · TP: ${market.signal.tp.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExecuteSignal(undefined, 1)}
                      className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer shadow-xs ${
                        market.signal.direction === 'BUY'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                      }`}
                    >
                      1-Click Execute {market.signal.direction}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab('execution')}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 font-bold cursor-pointer transition-colors"
                    >
                      View Signals Queue →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: SYSTEM AUDIT JOURNAL (TRADES TAKEN & SIGNALS LOGGED) */}
          {workspaceTab === 'journal' && (
            <div className="flex flex-col gap-3 sm:gap-4 w-full">
              <section aria-label="System audit journal" className="w-full">
                <AuditJournalPanel />
              </section>
            </div>
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

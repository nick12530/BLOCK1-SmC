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

import { MultiPairScannerPanel } from './components/MultiPairScannerPanel';
import { PairsSignalDeck } from './components/PairsSignalDeck';
import { BestOpportunityCard } from './components/BestOpportunityCard';
import { SignalEngineCard } from './components/SignalEngineCard';
import { DealingRangeZonesCard } from './components/DealingRangeZonesCard';
import { LiveExecutionCard } from './components/LiveExecutionCard';
import { OrderBlocksProgressionCard } from './components/OrderBlocksProgressionCard';
import { TradingViewWidget } from './components/TradingViewWidget';
import { RunningTradesHUD } from './components/RunningTradesHUD';
import { TradeLaunchpad } from './components/TradeLaunchpad';
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
  Layers,
  Activity,
  Zap,
  Briefcase,
  Columns,
  LayoutGrid,
  Maximize2,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
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

export type WorkspaceTab =
  | 'split'
  | 'chart'
  | 'launchpad'
  | 'signals'
  | 'positions'
  | 'zones'
  | 'scanner'
  | 'overview';

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

  // Master workspace tab: defaults to 'chart' on mobile and 'split' on desktop
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return 'chart';
    }
    return 'split';
  });

  // Secondary sub-tab for Left Pane within PC Dual Split Workstation mode
  const [splitLeftTab, setSplitLeftTab] = useState<'chart' | 'zones' | 'scanner'>('chart');

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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-[#08111a] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-sky-500/30 selection:text-white">
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

          {/* Real-Time Running Trades HUD: Unmistakable visibility into open positions & P&L */}
          <section aria-label="Running trades monitor" className="w-full">
            <RunningTradesHUD onOpenTradeStation={() => setWorkspaceTab('launchpad')} />
          </section>

          {/* Master Workspace Navigation Bar: PC & Mobile Optimized Tabs Arrangement */}
          <div className="w-full bg-white dark:bg-[#0c141d] border border-slate-200/90 dark:border-[#1a3040] rounded-xl sm:rounded-2xl p-1.5 sm:p-2 shadow-xs transition-colors">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Responsive Tabs Strip with smooth touch scrolling and no scrollbar */}
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar w-full lg:w-auto font-mono text-xs p-0.5">
                {/* 1. PC: Dual Split Workstation */}
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('split')}
                  className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    workspaceTab === 'split'
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#12202e]'
                  }`}
                  title="Institutional Dual-Pane Workstation: Chart on Left, Signals & Execution on Right"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Dual Split Workstation</span>
                </button>

                {/* 2. Start Trade Launchpad */}
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('launchpad')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    workspaceTab === 'launchpad'
                      ? 'bg-sky-500 text-slate-950 font-black shadow-xs ring-1 ring-sky-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#12202e]'
                  }`}
                  title="1-Click Trade Launchpad: Manual or Signal Order Execution"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-current" />
                  <span>Start Trade</span>
                </button>

                {/* 3. Primary Chart Terminal */}
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('chart')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    workspaceTab === 'chart'
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#12202e]'
                  }`}
                  title="Focused High-Resolution Candlestick Chart Terminal"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Chart</span>
                  <span className="hidden sm:inline">Terminal</span>
                </button>

                {/* 4. Signal Engine */}
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('signals')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap relative ${
                    workspaceTab === 'signals'
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#12202e]'
                  }`}
                  title="Multi-Strategy Signal Engine & 1-Click Execution"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Signals</span>
                  {market.signal && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                  )}
                </button>

                {/* 5. Live Positions */}
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('positions')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    workspaceTab === 'positions'
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#12202e]'
                  }`}
                  title="Open Positions, Trailing Stop, P&L & Trade Ledger"
                >
                  <Briefcase className="w-3.5 h-3.5 text-sky-400" />
                  <span>Positions</span>
                  {positionsState.positions.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-sky-500 text-slate-950 font-black">
                      {positionsState.positions.length}
                    </span>
                  )}
                </button>

                {/* 5. Zones & Order Blocks */}
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('zones')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    workspaceTab === 'zones'
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#12202e]'
                  }`}
                  title="Dealing Ranges, Equilibrium, and Order Block Progression"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Zones</span>
                  <span className="hidden sm:inline">&amp; OBs</span>
                </button>

                {/* 6. Cross-Pair Scanner */}
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('scanner')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    workspaceTab === 'scanner'
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#12202e]'
                  }`}
                  title="Multi-Pair SMC Scanner Matrix (4 Instruments)"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Scanner</span>
                  <span className="hidden sm:inline">Matrix</span>
                </button>

                {/* 7. Overview (All) - visible on mobile / tablet */}
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('overview')}
                  className={`lg:hidden flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    workspaceTab === 'overview'
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#12202e]'
                  }`}
                  title="Display all components stacked together in single scroll"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>All</span>
                </button>
              </div>

              {/* Right Desktop Telemetry */}
              <div className="hidden lg:flex items-center gap-2 text-xs font-mono">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-[#071018] px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-[#142232]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Continuous 4-Pair SMC Scanner Engine</span>
                </div>
              </div>
            </div>
          </div>

          {/* VIEW 1: DUAL SPLIT WORKSTATION (PC Institutional Layout) */}
          {workspaceTab === 'split' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 items-start">
              {/* Left Column (lg:col-span-7 xl:col-span-8): Primary Chart Terminal & Visualizer */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-3 sm:gap-4">
                {/* Secondary Sub-Tabs for Left Pane */}
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#1a3040] pb-2 pt-0.5 flex-wrap gap-2 font-mono text-xs">
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0c141d] p-0.5 rounded-lg border border-slate-200 dark:border-[#1a3040]">
                    <button
                      type="button"
                      onClick={() => setSplitLeftTab('chart')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        splitLeftTab === 'chart'
                          ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="High-resolution candlestick chart with SMC overlay"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Primary Chart Terminal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitLeftTab('zones')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        splitLeftTab === 'zones'
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
                      onClick={() => setSplitLeftTab('scanner')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        splitLeftTab === 'scanner'
                          ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Multi-pair scanner matrix"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Scanner Matrix</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('chart')}
                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    title="Expand Chart to Full Screen Width"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Focus Full Width</span>
                  </button>
                </div>

                {splitLeftTab === 'chart' && (
                  <section id="price-structure-chart" aria-label="FX chart" className="w-full">
                    <TradingViewWidget
                      isDark={isDark}
                      symbol={getInstrumentConfig(ticker.symbol).tvSymbol}
                      interval="1"
                      height={560}
                      onExpand={() => setActiveModal('tradingview')}
                      onOpenHelp={() => setActiveModal('help')}
                    />
                  </section>
                )}

                {splitLeftTab === 'zones' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full">
                    <section aria-label="Dealing Range Zones" className="w-full">
                      <DealingRangeZonesCard />
                    </section>
                    <section aria-label="Order Blocks Progression" className="w-full">
                      <OrderBlocksProgressionCard />
                    </section>
                  </div>
                )}

                {splitLeftTab === 'scanner' && (
                  <section aria-label="Multi-pair scanner" className="w-full">
                    <MultiPairScannerPanel
                      scannerAnalyses={scannerAnalyses}
                      activeSymbol={ticker.symbol}
                      onSelectSymbol={handleSelectSymbol}
                      onExecuteTrade={handleExecuteAnalysis}
                    />
                  </section>
                )}
              </div>

              {/* Right Column (lg:col-span-5 xl:col-span-4): Signals Deck & Live Execution Hub */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3 sm:gap-4">
                <section aria-label="Trade signals" className="w-full">
                  <SignalEngineCard onExecuteSignal={handleExecuteSignal} />
                </section>
                <section aria-label="Open positions" className="w-full">
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
              </div>
            </div>
          )}

          {/* VIEW: TRADE LAUNCHPAD (1-CLICK & MANUAL ORDER STATION) */}
          {workspaceTab === 'launchpad' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 items-start">
              <div className="lg:col-span-7 xl:col-span-8 w-full">
                <TradeLaunchpad
                  onSymbolSelect={handleSelectSymbol}
                  onTradeExecuted={() => setWorkspaceTab('positions')}
                />
              </div>
              <div className="lg:col-span-5 xl:col-span-4 w-full flex flex-col gap-3 sm:gap-4">
                <section aria-label="Trade signals" className="w-full">
                  <SignalEngineCard onExecuteSignal={handleExecuteSignal} />
                </section>
                <section aria-label="Open positions" className="w-full">
                  <LiveExecutionCard
                    onFocusChart={() => setWorkspaceTab('chart')}
                    onOpenClosedTradesModal={() => setActiveModal('closed_trades')}
                    onOpenDailyReportModal={() => setActiveModal('daily_report')}
                  />
                </section>
              </div>
            </div>
          )}

          {/* VIEW 2: PRIMARY CHART TERMINAL (FOCUSED VIEW - PC FULL WIDTH & MOBILE) */}
          {workspaceTab === 'chart' && (
            <div className="flex flex-col gap-3 sm:gap-4 w-full">
              <section id="price-structure-chart" aria-label="FX chart" className="w-full">
                <TradingViewWidget
                  isDark={isDark}
                  symbol={getInstrumentConfig(ticker.symbol).tvSymbol}
                  interval="1"
                  height={560}
                  onExpand={() => setActiveModal('tradingview')}
                  onOpenHelp={() => setActiveModal('help')}
                />
              </section>

              {/* Quick Signal Action Ribbon below chart */}
              {market.signal && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#0c141d] border border-slate-200 dark:border-[#1a3040] font-mono text-xs flex-wrap gap-2.5 shadow-xs transition-colors">
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
                      onClick={() => setWorkspaceTab('signals')}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer transition-colors"
                    >
                      Signal Details →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: SIGNAL ENGINE & CONFLUENCE */}
          {workspaceTab === 'signals' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 items-start">
              <div className="lg:col-span-7 xl:col-span-8 w-full">
                <section aria-label="Trade signals" className="w-full">
                  <SignalEngineCard onExecuteSignal={handleExecuteSignal} />
                </section>
              </div>
              <div className="lg:col-span-5 xl:col-span-4 w-full">
                <section aria-label="Open positions" className="w-full">
                  <LiveExecutionCard
                    onFocusChart={() => setWorkspaceTab('chart')}
                    onOpenClosedTradesModal={() => setActiveModal('closed_trades')}
                    onOpenDailyReportModal={() => setActiveModal('daily_report')}
                  />
                </section>
              </div>
            </div>
          )}

          {/* VIEW 4: LIVE POSITIONS & EXECUTION LEDGER */}
          {workspaceTab === 'positions' && (
            <div className="w-full">
              <section aria-label="Open positions" className="w-full">
                <LiveExecutionCard
                  onFocusChart={() => setWorkspaceTab('chart')}
                  onOpenClosedTradesModal={() => setActiveModal('closed_trades')}
                  onOpenDailyReportModal={() => setActiveModal('daily_report')}
                />
              </section>
            </div>
          )}

          {/* VIEW 5: ZONES & ORDER BLOCKS */}
          {workspaceTab === 'zones' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full">
              <section aria-label="Dealing Range Zones" className="w-full">
                <DealingRangeZonesCard />
              </section>
              <section aria-label="Order Blocks Progression" className="w-full">
                <OrderBlocksProgressionCard />
              </section>
            </div>
          )}

          {/* VIEW 6: MULTI-PAIR SCANNER MATRIX */}
          {workspaceTab === 'scanner' && (
            <section aria-label="Multi-pair scanner" className="w-full">
              <MultiPairScannerPanel
                scannerAnalyses={scannerAnalyses}
                activeSymbol={ticker.symbol}
                onSelectSymbol={handleSelectSymbol}
                onExecuteTrade={handleExecuteAnalysis}
              />
            </section>
          )}

          {/* VIEW 7: ALL-IN-ONE OVERVIEW (STACKED) */}
          {workspaceTab === 'overview' && (
            <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5">
              <section id="price-structure-chart" aria-label="FX chart" className="w-full">
                <TradingViewWidget
                  isDark={isDark}
                  symbol={getInstrumentConfig(ticker.symbol).tvSymbol}
                  interval="1"
                  height={520}
                  onExpand={() => setActiveModal('tradingview')}
                  onOpenHelp={() => setActiveModal('help')}
                />
              </section>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 items-start">
                <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-3 sm:gap-4">
                  <section aria-label="Trade signals" className="w-full">
                    <SignalEngineCard onExecuteSignal={handleExecuteSignal} />
                  </section>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full">
                    <DealingRangeZonesCard />
                    <OrderBlocksProgressionCard />
                  </div>
                </div>
                <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3 sm:gap-4">
                  <section aria-label="Open positions" className="w-full">
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
                  <MultiPairScannerPanel
                    scannerAnalyses={scannerAnalyses}
                    activeSymbol={ticker.symbol}
                    onSelectSymbol={handleSelectSymbol}
                    onExecuteTrade={handleExecuteAnalysis}
                  />
                </div>
              </div>
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

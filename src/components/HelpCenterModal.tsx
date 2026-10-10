/**
 * HelpCenterModal.tsx - Comprehensive Multi-Pair & Technical Indicator Guide
 * Expanded beyond SMC alone:
 * - Multi-Pair Playbook (XAUUSD, EURUSD, GBPUSD, USDJPY)
 * - Complete Indicator Suite (SMC Order Blocks, FVGs, ATR Volatility Bands, Candlesticks, MTF M1-H4, Sessions)
 * - Pending Limit Orders & Visual Holding Countdown Timer
 * - The 6 Institutional Execution Verification Gates
 * - Dealing Range & 50% Equilibrium (Discount vs Premium)
 * - MT5 Telemetry (Balance, Equity, Margin, Free Margin, Margin Level %)
 * - MT5 Live Broker Connector & Mobile PWA Installation
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  Zap,
  Layers,
  Smartphone,
  Server,
  DollarSign,
  CheckCircle2,
  Compass,
  ArrowLeft,
  Search,
  BarChart3,
  Globe,
  Clock,
  TrendingUp,
  Activity,
  ShieldAlert,
  Crosshair,
} from 'lucide-react';

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBridge: () => void;
  initialTab?: TabType;
}

type TabType =
  | 'system_engines'
  | 'pairs_matrix'
  | 'indicators_suite'
  | 'pending_orders'
  | 'valid_signals'
  | 'dealing_range'
  | 'balances'
  | 'abbreviations'
  | 'mt5'
  | 'phone_pwa';

interface TabItem {
  id: TabType;
  num: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'system_engines', num: '01', title: 'System Engines', desc: '10 Core Engines Defined & Architecture', icon: Activity },
  { id: 'pairs_matrix', num: '02', title: 'Currency Pairs', desc: 'XAUUSD, EUR, GBP, JPY playbooks', icon: Globe },
  { id: 'indicators_suite', num: '03', title: 'Indicator Suite', desc: 'ATR, Candles, MTF, Sessions (UTC & EAT)', icon: BarChart3 },
  { id: 'pending_orders', num: '04', title: 'Pending Limit Orders', desc: 'Holding timer & auto-cancel', icon: Clock },
  { id: 'valid_signals', num: '05', title: 'Execution Gates', desc: 'SFP, 1.5R Scale-Out, OB Trailing & Rules', icon: Zap },
  { id: 'dealing_range', num: '06', title: 'Dealing Range & EQ', desc: 'Discount vs Premium zones', icon: Compass },
  { id: 'balances', num: '07', title: 'MT5 Balances & Margin', desc: 'Capital & leverage guide', icon: DollarSign },
  { id: 'abbreviations', num: '08', title: 'Glossary & SMC', desc: 'OB, BOS, CHoCH, FVG, ATR, SFP', icon: Layers },
  { id: 'mt5', num: '09', title: 'MT5 Live Bridge', desc: 'Broker execution & socket sync', icon: Server },
  { id: 'phone_pwa', num: '10', title: 'Mobile Server & PWA', desc: 'Start server on phone & install app', icon: Smartphone },
];

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({
  isOpen,
  onClose,
  onOpenBridge,
  initialTab = 'pairs_matrix',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return TABS;
    const q = searchQuery.toLowerCase();
    return TABS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0d1823] border border-slate-200 dark:border-[#1a3040] rounded-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col shadow-xl overflow-hidden font-mono text-xs transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-zinc-950 dark:text-white uppercase tracking-wider">
                Multi-Asset Trading Terminal Guide
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Playbooks for all 4 pairs, full indicators suite, pending limit orders &amp; MT5 execution
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Grid Tab Selectors */}
        <div className="p-3 sm:px-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2.5 shrink-0">
          {/* Quick Search Input */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search pairs, indicators (e.g. EURUSD, ATR, countdown, discount, MT5)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none text-xs text-zinc-900 dark:text-white w-full font-sans"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Upgraded Grid Item Selectors */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
            {filteredTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-zinc-950 text-white dark:bg-sky-500 dark:text-slate-950 border-zinc-950 dark:border-sky-400 shadow-xs'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-mono opacity-70">{tab.num}</span>
                  </div>
                  <span className="font-bold text-[11px] leading-tight truncate w-full">
                    {tab.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-sans text-xs">
          {/* TAB 0: SYSTEM ENGINES ARCHITECTURE */}
          {activeTab === 'system_engines' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  The 10 Algorithmic Engines Powering the System
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  The terminal operates on a modular, multi-pipeline architecture. Below is the comprehensive technical definition and operational functionality of every engine running the system:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                {/* Engine 1 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-sky-600 dark:text-sky-400">
                    <Layers className="w-3.5 h-3.5" />
                    <span>1. Market Structure Engine (MSE)</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <strong>Functionality:</strong> Detects multi-bar fractal swing highs and swing lows without lookahead bias using a strict confirmation delay. Identifies <strong>Break of Structure (BOS)</strong> for trend continuation, <strong>Change of Character (CHoCH)</strong> for early structural reversals, and establishes the institutional <strong>Dealing Range</strong> (High, Low, and the 50% Equilibrium line).
                  </p>
                </div>

                {/* Engine 2 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    <Compass className="w-3.5 h-3.5" />
                    <span>2. SMC POI Engine (Order Blocks &amp; FVGs)</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <strong>Functionality:</strong> Identifies Bullish (+OB) Demand Order Blocks and Bearish (-OB) Supply Order Blocks using 20-period rolling body size displacement filters. Detects 3-candle Fair Value Gaps (FVG) and tracks their exact mitigation and fill status across live price ticks.
                  </p>
                </div>

                {/* Engine 3 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-amber-600 dark:text-amber-400">
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>3. Liquidity Sweep &amp; SFP Gate Engine</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <strong>Functionality:</strong> Requires an aggressive wick sweep of an Asian session high/low or prior swing extreme that immediately rejects back inside the range (Swing Failure Pattern). Swept liquidity captures institutional stop orders and significantly elevates trade win rates on Gold (XAUUSD) and Forex.
                  </p>
                </div>

                {/* Engine 4 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-rose-600 dark:text-rose-400">
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>4. Candlestick Physics &amp; Rejection Engine</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <strong>Functionality:</strong> Measures candlestick anatomy, wick-to-body ratios (&gt;65% rejection wick required), Pinbars, and Engulfing displacement. Scores candle pattern reliability (80%–95%) and prevents entering on indecision bars or candles closing against direction.
                  </p>
                </div>

                {/* Engine 5 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-purple-600 dark:text-purple-400">
                    <Activity className="w-3.5 h-3.5" />
                    <span>5. Multi-Timeframe (MTF) Alignment Engine</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <strong>Functionality:</strong> Harmonizes trends and dealing ranges across 5 timeframes: <strong>M1, M5, M15, H1, and H4</strong>. Ensures that lower-timeframe execution triggers (M1/M5) strictly agree with higher-timeframe order flow (M15/H1/H4).
                  </p>
                </div>

                {/* Engine 6 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-indigo-600 dark:text-indigo-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>6. Session &amp; Timing Filter Engine (UTC &amp; EAT)</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <strong>Functionality:</strong> Filters execution by institutional market hours. Prioritizes <strong>London Open (07:00–10:00 UTC / 10:00–13:00 EAT)</strong> and <strong>New York AM / Silver Bullet (13:00–16:00 UTC / 16:00–19:00 EAT)</strong>. Suppresses low-liquidity Asian consolidation (21:00–05:00 UTC / 00:00–08:00 EAT) to prevent whipsaws, while auto-authorizing high-profit exception setups (Score &ge; 6.5 / RR &ge; 2.5) across all currency pairs.
                  </p>
                </div>

                {/* Engine 7 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-teal-600 dark:text-teal-400">
                    <Globe className="w-3.5 h-3.5" />
                    <span>7. Multi-Pair SMC Scanner Engine</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <strong>Functionality:</strong> Background radar continuously scanning 4 assets (XAUUSD, EURUSD, GBPUSD, USDJPY). Computes real-time scores (0–100), detects session bias, evaluates fresh POIs, and feeds opportunities to the top dashboard deck.
                  </p>
                </div>

                {/* Engine 8 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-rose-500">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>8. Automated Risk &amp; Compounding Engine</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <strong>Functionality:</strong> Computes dynamic position sizing from account equity and stop loss distance. Enforces a 7-stage compounding ladder from $10 micro accounts to $10,000+ institutional tiers, daily drawdown limits (-12%), basket profit target locks (+15%), and correlated exposure limits.
                  </p>
                </div>

                {/* Engine 9 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-amber-500">
                    <Zap className="w-3.5 h-3.5" />
                    <span>9. Order Lifecycle &amp; Scale-Out Execution Engine</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <strong>Functionality:</strong> Manages limit orders with holding timers and drift invalidation. Automates <strong>Multi-Tier Partial Profit Taking (Scale-Out)</strong>: closes 50% volume at 1.5R, moves Stop Loss to Breakeven + 2 points, trails SL along newly formed Order Blocks on subsequent BOS breaks, and lets the remaining 50% runner target 3.0R+ institutional POIs.
                  </p>
                </div>

                {/* Engine 10 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-blue-500">
                    <Server className="w-3.5 h-3.5" />
                    <span>10. MT5 ZeroMQ Bridge &amp; Phone Server Engine</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <strong>Functionality:</strong> High-performance bridge syncing real-time broker ticks, margin, and order execution with MetaTrader 5. When offline, operates as a self-contained algorithmic station. Features native mobile server launchers (<code>./start-on-phone.sh</code>) for Termux and iSH with Tailscale remote network synchronization.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: CURRENCY PAIRS PLAYBOOK */}
          {activeTab === 'pairs_matrix' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Institutional Multi-Pair Playbook (4 Supported Instruments)
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  The terminal scans, scores, and executes across 4 distinct financial markets. All sessions are quoted in both UTC and East Africa Time (EAT = UTC+3):
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                {/* Gold */}
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.03] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black">XAUUSD</span>
                      <span>Gold Spot / USD</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-amber-500">Commodity Metal</span>
                  </div>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-300 leading-relaxed list-disc list-inside">
                    <li><strong>Point Value:</strong> $1.00 per point per 1.0 standard lot.</li>
                    <li><strong>Key Drivers:</strong> US CPI, Non-Farm Payrolls, Treasury Yields, and Safe-Haven flows.</li>
                    <li><strong>Prime Window:</strong> London/New York Overlap (13:00 - 16:00 UTC / 16:00 - 19:00 EAT) produces maximum institutional volume.</li>
                    <li><strong>Execution Rule:</strong> Enter at unmitigated 15m/1h Order Blocks in deep Discount/Premium dealing ranges with SFP liquidity sweep confirmation.</li>
                  </ul>
                </div>

                {/* EURUSD */}
                <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/[0.03] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-black">EURUSD</span>
                      <span>Euro / US Dollar</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-sky-500">FX Major #1</span>
                  </div>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-300 leading-relaxed list-disc list-inside">
                    <li><strong>Pip Value:</strong> $10.00 per pip (0.0001) per 1.0 standard lot. Lowest broker spreads (0.6 - 1.2 pips).</li>
                    <li><strong>Key Drivers:</strong> ECB rate decisions, Federal Reserve rate differentials, Eurozone manufacturing PMIs.</li>
                    <li><strong>Prime Window:</strong> London Open (07:00 - 10:00 UTC / 10:00 - 13:00 EAT) sets the directional trend of the day.</li>
                    <li><strong>Execution Rule:</strong> Look for Asian session liquidity sweeps followed by clean Fair Value Gap imbalances.</li>
                  </ul>
                </div>

                {/* GBPUSD */}
                <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.03] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-black">GBPUSD</span>
                      <span>British Pound / USD (&quot;Cable&quot;)</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-indigo-500">High-Beta FX</span>
                  </div>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-300 leading-relaxed list-disc list-inside">
                    <li><strong>Pip Value:</strong> $10.00 per pip per 1.0 lot. Higher ATR (Average True Range) than EURUSD.</li>
                    <li><strong>Key Drivers:</strong> Bank of England MPC decisions, UK GDP, US Dollar DXY strength.</li>
                    <li><strong>Prime Window:</strong> Frankfurt/London open (06:30 - 11:00 UTC / 09:30 - 14:00 EAT). Known for aggressive stop sweeps.</li>
                    <li><strong>Execution Rule:</strong> Wait for Breaker Blocks and clear CHoCH structural reversals after liquidity pool raids.</li>
                  </ul>
                </div>

                {/* USDJPY */}
                <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/[0.03] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-black">USDJPY</span>
                      <span>US Dollar / Japanese Yen</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-rose-500">Asian Benchmark</span>
                  </div>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-300 leading-relaxed list-disc list-inside">
                    <li><strong>Pip Value:</strong> 0.01 = 1 pip. Multi-hour clean trend continuation characteristics.</li>
                    <li><strong>Key Drivers:</strong> US 10Y Treasury Yield correlation, Bank of Japan policy adjustments.</li>
                    <li><strong>Prime Window:</strong> Tokyo Asian Session (00:00 - 09:00 UTC / 03:00 - 12:00 EAT) and NY AM (13:00 - 17:00 UTC / 16:00 - 20:00 EAT).</li>
                    <li><strong>Execution Rule:</strong> Trend-following pullback entries at 50% Equilibrium during strong bond yield moves.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TECHNICAL & INDICATOR SUITE */}
          {activeTab === 'indicators_suite' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Comprehensive Technical Indicators Suite (Beyond SMC Alone)
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  The terminal integrates institutional Smart Money Concepts with classical quantitative indicators to filter false signals and maximize win rates:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-xs block flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    <span>1. ATR (Average True Range) Dynamic Volatility Stops</span>
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Stops are not static! The engine measures 14-period market volatility in real time. During volatility expansions, stop losses adapt dynamically to prevent premature stop hunts while keeping risk exposure strictly bounded.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs block flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>2. Candlestick &amp; Price Action Pattern Confirmation</span>
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Automated pattern detection checks for <strong>Pinbars</strong> (&gt;65% rejection wick), <strong>Bullish/Bearish Engulfing</strong>, and <strong>Momentum Exhaustion</strong> candles directly at key levels before executing.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs block flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>3. Multi-Timeframe (MTF) Alignment: 1m, 5m, 15m, 1h, 4h</span>
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Includes the newly added <strong>4-hour (H4) macro timeframe</strong> alongside 1h, 15m, 5m, and 1m. Trades require higher-timeframe trend alignment with lower-timeframe execution triggers.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs block flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>4. Session Kill-Zones &amp; Dual Real-Time Clocks (UTC &amp; EAT)</span>
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Tracks dual clocks in UTC and <strong>East Africa Time (EAT = UTC+3)</strong>:
                    <br />• <strong>London Open:</strong> 07:00–10:00 UTC (10:00–13:00 EAT)
                    <br />• <strong>New York AM / Silver Bullet:</strong> 13:00–16:00 UTC (16:00–19:00 EAT)
                    <br />• <strong>London Full Session:</strong> 08:00–17:00 UTC (11:00–20:00 EAT)
                    <br />• <strong>New York Full Session:</strong> 13:00–22:00 UTC (16:00–01:00 EAT)
                    <br />• <strong>Asian Tokyo Session:</strong> 00:00–09:00 UTC (03:00–12:00 EAT)
                    <br />• <strong>Asian Consolidation Window:</strong> 21:00–05:00 UTC (00:00–08:00 EAT) (suppressed unless high-profit exception)
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-emerald-500 text-xs block flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>5. Pure Coloured Lines (Zero Obscuring Bars)</span>
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    All indicator overlays render as crisp horizontal dotted lines with centered text labels. No opaque or colored bars cover candlesticks, keeping price action 100% visible and clean.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-rose-500 text-xs block flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>6. Live Broker Spread &amp; Tick-Value Sizing</span>
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Direct broker quotes provide real-time point-to-pip spreads and contract sizing per currency pair, freezing execution if spreads widen during sudden news releases.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PENDING LIMIT ORDERS & COUNTDOWN TIMER */}
          {activeTab === 'pending_orders' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Pending Limit Orders &amp; Visual Holding Countdown Timer
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Institutional trading does not chase market price. The engine queues pending limit orders at confirmed Order Blocks and POI levels:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-amber-500 text-xs block flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>1. Minimalist Visual Countdown</span>
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    The <code>LiveExecutionCard</code> features a sleek countdown timer (e.g. <code>03:00</code> hold window). It shows exactly how long the engine will hold an entry before cancelling.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-rose-500 text-xs block flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>2. Automatic Drift Invalidation</span>
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    If market price moves away from entry beyond the allowed drift threshold (&gt;15 pips on FX, &gt;25 points on Gold), the order is automatically cancelled to prevent poor fills.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-emerald-500 text-xs block flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>3. Instant Fill or User Cancel</span>
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    If price sweeps the POI level, the order fills into an active broker trade immediately. Traders can also click <code>Fill Now</code> for immediate market entry or <code>Cancel</code> at any time.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 6 VERIFICATION GATES */}
          {activeTab === 'valid_signals' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  The 6 Institutional Verification Gates
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Every auto and manual signal must pass all 6 mathematical gates before execution:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Gate 1: Minimum 1:2.0 Risk/Reward</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Stop loss is capped tightly while Take Profit targets at least 2x risk, ensuring positive long-term mathematical expectancy.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Gate 2: Order Block Confluence (+OB / -OB)</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Buys occur only at validated Bullish Order Blocks (+OB); Sells only at Bearish Order Blocks (-OB). Order block always renders for active trades.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Gate 3: Discount vs Premium Pricing</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Buys are restricted to Discount (&lt; 50% Equilibrium); Sells are restricted to Premium (&gt; 50% Equilibrium). Never buy wholesale high or sell wholesale low.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Gate 4: Fair Value Gap Displacement</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Requires a 3-candle imbalance (FVG) confirming aggressive institutional volume behind the move.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Gate 5: Low Spread Gate (&le; 40 pts)</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Execution automatically freezes if live broker spread exceeds safe thresholds to protect from news slippage.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Gate 6: Daily Loss Circuit Breaker</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Hard stop if daily drawdown reaches configured risk ceiling (or consecutive losses hit 3), preserving account capital until the next trading day.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.03] space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>Gate 7: Multi-Tier 1.5R Scale-Out &amp; BE+2pts</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Positions do not remain all-or-nothing. At 1.5R, 50% of volume automatically closes to bank realized profit and cover commission. Stop Loss is simultaneously relocated to Breakeven + 2 points. The remaining 50% runner targets the full 3.0R+ institutional POI.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-purple-500/30 bg-purple-500/[0.03] space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
                    <span>Gate 8: Formed Order Block Swing Trailing Stop</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    As price prints new structural swing highs/lows and breaks beyond them (BOS), the stop loss is dynamically trailed to the base of each newly confirmed Order Block rather than sitting at a static entry.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-sky-500/30 bg-sky-500/[0.03] space-y-1 sm:col-span-2">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
                    <span>Gate 9: Liquidity Sweep / SFP Gate &amp; Session Timing</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Orders require a wick sweep of an Asian session high/low or prior swing extreme that immediately rejects back inside the range (Swing Failure Pattern). Entries are restricted to high-volume windows: <strong>London Open (07:00–10:00 UTC / 10:00–13:00 EAT)</strong> and <strong>New York AM / Silver Bullet (13:00–16:00 UTC / 16:00–19:00 EAT)</strong>. Asian consolidation entries (21:00–05:00 UTC / 00:00–08:00 EAT) are suppressed to prevent false breakouts, with automated exceptions granted for high-profit setups across all currency pairs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DEALING RANGE & EQUILIBRIUM */}
          {activeTab === 'dealing_range' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Auction Market Dealing Range &amp; Equilibrium
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  The Dealing Range defines active price boundaries between the most recent major <strong>Swing High</strong> and <strong>Swing Low</strong>:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs block">
                    Discount Zone (&lt; 50% Equilibrium)
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Any price below 50% Equilibrium is wholesale pricing. Smart money accumulates long/buy positions in Discount, maximizing upside expansion toward swing highs.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs block">
                    Premium Zone (&gt; 50% Equilibrium)
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Any price above 50% Equilibrium is retail markup. Smart money distributes short/sell positions in Premium, offering maximum risk-to-reward for downward moves.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: MT5 BALANCES & MARGIN */}
          {activeTab === 'balances' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Account Capital, Equity &amp; Free Margin (MetaTrader 5 Format)
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  The top telemetry bar and live execution monitor display exact MT5 terminal metrics formatted identically to the MetaTrader 5 Toolbox trade bar:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-zinc-950 dark:text-white text-xs block">
                    1. Balance (USD)
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Settled cash balance in your broker account (e.g. <code>10,000.00 USD</code>). Changes only upon closing positions.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs block">
                    2. Live Equity
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Real-time account value: <code>Balance + Floating P&amp;L</code>. Represents exact liquidation value at this instant.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-xs block">
                    3. Margin &amp; Free Margin
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Margin used by open positions and Free Margin available for new trades. Margin Level % indicates safety threshold.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: GLOSSARY */}
          {activeTab === 'abbreviations' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Indicators &amp; Market Structure Glossary
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Key abbreviations and concepts used across signal decks and chart overlays:
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <strong className="font-mono text-emerald-600 dark:text-emerald-400 block">+OB (Bullish Order Block)</strong>
                  <span className="text-zinc-500 text-[11px]">Last down candle before displacement. Demand zone for buying.</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <strong className="font-mono text-rose-600 dark:text-rose-400 block">-OB (Bearish Order Block)</strong>
                  <span className="text-zinc-500 text-[11px]">Last up candle before displacement. Supply zone for selling.</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <strong className="font-mono text-blue-600 dark:text-blue-400 block">BOS (Break of Structure)</strong>
                  <span className="text-zinc-500 text-[11px]">Candle body closes beyond previous swing high/low in trend direction.</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <strong className="font-mono text-purple-600 dark:text-purple-400 block">CHoCH (Change of Character)</strong>
                  <span className="text-zinc-500 text-[11px]">First break of structure signaling trend reversal.</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <strong className="font-mono text-amber-600 dark:text-amber-400 block">FVG (Fair Value Gap)</strong>
                  <span className="text-zinc-500 text-[11px]">3-candle price imbalance acting as magnetic liquidity pool.</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <strong className="font-mono text-zinc-900 dark:text-zinc-100 block">ATR (Volatility)</strong>
                  <span className="text-zinc-500 text-[11px]">Average True Range used to dynamically size protective stop distances.</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: MT5 CONNECTOR */}
          {activeTab === 'mt5' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Link with MetaTrader 5 (MT5) Broker
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Stream live broker ticks and execute signals directly into your real or demo broker terminal via the 1-click Python bridge or native MQL5 Expert Advisor:
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onOpenBridge();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono transition-colors text-xs cursor-pointer"
                >
                  Open MT5 Bridge Setup Window
                </button>
              </div>
            </div>
          )}

          {/* TAB 9: MOBILE PWA */}
          {activeTab === 'phone_pwa' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Install as Standalone Mobile App (iOS &amp; Android)
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Progressive Web App (PWA) configured for edge-to-edge OLED mobile screens with zero browser address bar jumping:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-white font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800">iOS</span>
                    <span>iPhone &amp; iPad (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400">
                    <li>Open this URL in <strong>Safari</strong> on your iPhone.</li>
                    <li>Tap the <strong>Share</strong> icon (square with arrow up).</li>
                    <li>Select <strong>&quot;Add to Home Screen&quot;</strong>.</li>
                    <li>Tap <strong>&quot;Add&quot;</strong> in top-right.</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-white font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">Android</span>
                    <span>Google Chrome</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400">
                    <li>Open this URL in <strong>Google Chrome</strong>.</li>
                    <li>Tap the <strong>3 dots menu (&vellip;)</strong>.</li>
                    <li>Select <strong>&quot;Install App&quot;</strong> or <strong>&quot;Add to Home Screen&quot;</strong>.</li>
                    <li>Confirm installation.</li>
                  </ol>
                </div>
              </div>

              {/* Start Local Server Directly on Phone */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-400">Launch Phone Server (Android Termux or iOS iSH)</span>
                  <span className="text-[10px] text-zinc-400">1-Command Launcher</span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/80 text-emerald-400 text-[10px] font-mono leading-relaxed border border-zinc-800 overflow-x-auto">
                  # 1. On Android Termux:<br />
                  pkg update &amp;&amp; pkg install nodejs git<br />
                  bash start-on-phone.sh<br />
                  <br />
                  # 2. Or run zero-dependency mobile HTTP daemon directly:<br />
                  node scripts/mobile-server.js<br />
                  <br />
                  # Access in mobile browser: http://localhost:3000 (or your Wi-Fi LAN IP)
                </div>
                <div className="text-[10px] text-zinc-400 space-y-1">
                  <p>• <strong>Tailscale Remote Sync:</strong> Connect your phone to your Tailscale mesh network (e.g. <code>http://100.x.y.z:8000</code>). The terminal will sync ticks and trades to your desktop MT5 terminal securely over cellular data.</p>
                  <p>• <strong>100% Standalone Offline Mode:</strong> If MT5 is not reachable, the system automatically runs as a full client-side algorithmic trading workstation with real-time indicators and simulated execution.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between shrink-0 font-mono">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Terminal</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-black transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

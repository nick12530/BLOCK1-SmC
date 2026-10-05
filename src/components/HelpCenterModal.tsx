/**
 * HelpCenterModal.tsx - Comprehensive Institutional Knowledge Base & Help Centre
 * Upgraded with advanced item selectors and search:
 * - Search bar across all SMC concepts, gates, and mechanics
 * - Responsive segmented category item selectors
 * - Full coverage: 6 Verification Gates, Dealing Range / Equilibrium,
 *   Balances & Margins, Glossary, Mobile PWA, MT5 Bridge
 * - Clean Back to Terminal and Done dismissal buttons
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
  AlertTriangle,
  Compass,
  ArrowLeft,
  Search,
} from 'lucide-react';

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBridge: () => void;
  initialTab?: TabType;
}

type TabType =
  | 'valid_signals'
  | 'dealing_range'
  | 'balances'
  | 'abbreviations'
  | 'phone_pwa'
  | 'mt5';

interface TabItem {
  id: TabType;
  num: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'valid_signals', num: '01', title: 'Signal Checklist', desc: '6 verification gates', icon: Zap },
  { id: 'dealing_range', num: '02', title: 'Dealing Range & EQ', desc: 'Discount vs Premium zones', icon: Compass },
  { id: 'balances', num: '03', title: 'Balances & Margin', desc: 'Capital & leverage guide', icon: DollarSign },
  { id: 'abbreviations', num: '04', title: 'SMC Glossary', desc: 'OB, BOS, CHoCH, FVG', icon: Layers },
  { id: 'phone_pwa', num: '05', title: 'Mobile App (PWA)', desc: 'Install on iOS & Android', icon: Smartphone },
  { id: 'mt5', num: '06', title: 'MT5 Connector', desc: 'Live broker execution bridge', icon: Server },
];

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({
  isOpen,
  onClose,
  onOpenBridge,
  initialTab = 'valid_signals',
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
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0d1823] border border-slate-200 dark:border-[#1a3040] rounded-2xl w-full max-w-3xl max-h-[92dvh] flex flex-col shadow-xl overflow-hidden font-mono text-xs transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-zinc-950 dark:text-white uppercase tracking-wider">
                Institutional Help Center & Guide
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Deterministic SMC gates, dealing ranges, and broker bridge instructions
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

        {/* Search Bar & Item Selectors Strip */}
        <div className="p-3 sm:px-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2.5 shrink-0">
          {/* Quick Search Input */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search concepts (e.g. discount, drawdown, spread, FVG, MT5)..."
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
            {filteredTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-black border-zinc-950 dark:border-white shadow-xs'
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
          {/* TAB 1: HOW TO KNOW A SIGNAL IS VALID & PROFITABLE */}
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
                    Stop loss is capped tightly (4.0 pts / 40 pips) while Take Profit targets at least 8.0 pts (+80 pips), ensuring positive mathematical expectancy.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Gate 2: Order Block Confluence (+OB / -OB)</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Buys occur only at validated Bullish Order Blocks (+OB) where institutions injected capital; Sells only at Bearish Order Blocks (-OB).
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
                    Requires a 3-candle imbalance (FVG) confirming aggressive institutional buying or selling volume behind the move.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Gate 5: Low Spread Gate (&le; 40 pts)</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Execution automatically freezes if live broker spread exceeds 40 points (4.0 pips) to protect from news slippage.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Gate 6: Daily Loss Circuit Breaker</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Hard stop if daily drawdown reaches 3.0%, preserving account capital until the next trading day.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEALING RANGE & EQUILIBRIUM */}
          {activeTab === 'dealing_range' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Auction Market Dealing Range &amp; Equilibrium
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  The Dealing Range defines the active price boundaries between the most recent major <strong>Swing High</strong> and <strong>Swing Low</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs block">
                    Discount Zone (&lt; 50% Equilibrium)
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Any price below 50% Equilibrium is wholesale pricing ("cheap"). <strong>Smart money only accumulates long/buy positions in Discount</strong>. Buying in discount maximizes upside expansion to the opposing swing high.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs block">
                    Premium Zone (&gt; 50% Equilibrium)
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Any price above 50% Equilibrium is retail markup ("expensive"). <strong>Smart money only distributes short/sell positions in Premium</strong>. Selling in premium offers the highest risk-to-reward for downward displacement.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GOLD SPOT VS MT5 ACCOUNT BALANCE */}
          {activeTab === 'balances' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Account Capital, Equity &amp; Free Margin
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Key financial telemetry explained for small and large accounts:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-zinc-950 dark:text-white text-xs block">
                    1. Cash Balance
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Settled cash funds in your broker account. Changes only when a trade is closed.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs block">
                    2. Live Floating Equity
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Real-time account value: <code>Balance + Open Trades P&amp;L</code>. Reflects exact cash value if all trades were closed immediately.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs block">
                    3. Free Margin
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Available collateral to open new positions after subtracting used margin required by your broker.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SMC ABBREVIATIONS GLOSSARY */}
          {activeTab === 'abbreviations' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Institutional Smart Money Concepts (SMC) Glossary
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Industry-standard abbreviations used across terminal alerts and signal readouts:
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
                  <strong className="font-mono text-zinc-900 dark:text-zinc-100 block">BE (Break-Even Lock)</strong>
                  <span className="text-zinc-500 text-[11px]">Stop loss moved to entry price + 0.3 to eliminate downside risk.</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PHONE PWA INSTALLATION */}
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
            </div>
          )}

          {/* TAB 6: MT5 CONNECTOR */}
          {activeTab === 'mt5' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Link with MetaTrader 5 (MT5) Broker
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Stream live broker ticks and execute signals directly into your real or demo broker terminal via the 1-click Windows batch script or native MQL5 Expert Advisor.
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

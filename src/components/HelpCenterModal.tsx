/**
 * HelpCenterModal.tsx - Comprehensive Institutional Knowledge Base & Help Centre
 * Professionally arranged with:
 * 1. Valid & Profitable Signal Checklist (The 6 Institutional Verification Gates)
 * 2. Dealing Range & Equilibrium (Discount vs Premium Explained)
 * 3. Gold Spot Price vs MT5 Account Capital (Why there are two numbers at the top)
 * 4. Complete SMC Abbreviations Index (+OB, -OB, MT, BOS, CHoCH, FVG, TP, SL, EQ, RR)
 * 5. Standalone Phone Installation (PWA for iOS & Android)
 * 6. MetaTrader 5 (MT5) Auto-Execution Connector
 */

import React, { useState } from 'react';
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

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({
  isOpen,
  onClose,
  onOpenBridge,
  initialTab = 'valid_signals',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-950 dark:text-white">
                SMC Institutional Help Centre
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Signal verification rules, dealing ranges, and indicator mechanics
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs - Horizontally scrollable on mobile */}
        <div className="flex items-center gap-1 px-3 sm:px-6 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 overflow-x-auto no-scrollbar whitespace-nowrap text-[11px]">
          {[
            { id: 'valid_signals', label: '1. Valid Signal Checklist', icon: Zap },
            { id: 'dealing_range', label: '2. Dealing Range & EQ', icon: Compass },
            { id: 'balances', label: '3. Gold Spot vs Balance', icon: DollarSign },
            { id: 'abbreviations', label: '4. SMC Glossary', icon: Layers },
            { id: 'phone_pwa', label: '5. Install on Phone', icon: Smartphone },
            { id: 'mt5', label: '6. MT5 Connector', icon: Server },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-sans">
          {/* TAB 1: HOW TO KNOW A SIGNAL IS VALID & PROFITABLE */}
          {activeTab === 'valid_signals' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  How Do I Know a Signal is Valid &amp; Profitable?
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  In Smart Money Concepts, banks and institutional algorithms do not guess. A signal is considered high-probability and tradeable only when it passes the <strong>6 Institutional Verification Gates</strong>:
                </p>
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center gap-2 font-mono font-bold text-zinc-950 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                      1
                    </span>
                    <span>Confluence Score &ge; 4.0 / 5.0 Stars</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 pl-7 leading-relaxed">
                    The terminal automatically scores every setup from 1.0 to 5.0. <strong>Only execute trades with 4.0★ or higher</strong>. Scores below 4.0 indicate low-volume chop or counter-trend risk.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center gap-2 font-mono font-bold text-zinc-950 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <span>Dealing Range Alignment (Discount for BUY, Premium for SELL)</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 pl-7 leading-relaxed">
                    Check the Dealing Range meter: For a <strong>BUY</strong>, price must be in <strong>Discount (&lt; 50% Equilibrium)</strong>. For a <strong>SELL</strong>, price must be in <strong>Premium (&gt; 50% Equilibrium)</strong>. Never buy at the top or sell at the bottom.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center gap-2 font-mono font-bold text-zinc-950 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                      3
                    </span>
                    <span>Fresh Order Block Retest (+OB / -OB) &amp; 50% MT Respect</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 pl-7 leading-relaxed">
                    Price must retest an unmitigated Order Block. The candle wicks may pierce the block, but <strong>the candle bodies must not close beyond the 50% Mean Threshold (MT)</strong>. A close beyond the MT invalidates the setup.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center gap-2 font-mono font-bold text-zinc-950 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                      4
                    </span>
                    <span>Active Session Kill Zone Timing</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 pl-7 leading-relaxed">
                    The highest win-rate signals occur during high-volume bank hours: <strong>London Kill Zone (07:00–10:00 UTC)</strong> and <strong>New York Kill Zone (12:00–15:00 UTC)</strong>. Avoid taking large trades during the late Asian consolidation.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center gap-2 font-mono font-bold text-zinc-950 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                      5
                    </span>
                    <span>Favorable Risk-to-Reward Ratio (&ge; 1:2.0 RR)</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 pl-7 leading-relaxed">
                    Every generated signal maintains at least a <strong>1:2.0 Risk-to-Reward ratio</strong>. With 1:2.0 RR, even a 40% win rate generates consistent net profits because your wins are twice the size of your losses.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center gap-2 font-mono font-bold text-zinc-950 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                      6
                    </span>
                    <span>Low Spread Filter (&le; 40 Points / 4.0 Pips)</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 pl-7 leading-relaxed">
                    During major news releases (CPI, NFP, FOMC), broker spreads can spike. The terminal automatically locks execution if the gold spread exceeds 40 points to protect against slippage.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEALING RANGE & EQUILIBRIUM */}
          {activeTab === 'dealing_range' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  What Does the Dealing Range Do?
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  In auction market theory, the Dealing Range defines the active price boundaries between the most recent major <strong>Swing High</strong> and <strong>Swing Low</strong> on higher timeframes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs block">
                    Discount Zone (&lt; 50% Equilibrium)
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Any price below 50% Equilibrium is wholesale pricing ("cheap"). <strong>Smart money only accumulates long/buy positions in Discount</strong>. Buying in discount maximizes upside expansion to the opposing swing high.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs block">
                    Premium Zone (&gt; 50% Equilibrium)
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Any price above 50% Equilibrium is retail markup ("expensive"). <strong>Smart money only distributes short/sell positions in Premium</strong>. Selling in premium offers the highest risk-to-reward for downward displacement.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs block">
                  Equilibrium (EQ - 50% Midpoint)
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Equilibrium is the exact 50% fair-value point calculated as: <code>(Swing High + Swing Low) &divide; 2</code>. When price reaches equilibrium, smart money often takes partial profits (TP1) and sets stop loss to break-even (BE).
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: GOLD SPOT VS MT5 ACCOUNT BALANCE */}
          {activeTab === 'balances' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Why Are There Two Dollar Amounts in the Header?
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  The two dollar amounts displayed at the top represent two completely different pieces of financial data:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-zinc-950 dark:text-white font-mono font-bold text-xs">
                    <span className="w-2 h-2 rounded bg-amber-500" />
                    <span>1. Gold Spot (oz) · Asset Market Price</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    This is the real-time interbank price of <strong>1 troy ounce of physical Gold (XAUUSD)</strong> in US Dollars (e.g. <code>$4,190.64</code>). It updates with every interbank tick and determines entry, TP, and SL price levels.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-zinc-950 dark:text-white font-mono font-bold text-xs">
                    <span className="w-2 h-2 rounded bg-emerald-500" />
                    <span>2. Account · Your Trading Capital</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    This is your actual <strong>account deposit balance</strong> inside your connected MetaTrader 5 broker terminal (e.g. <code>$10,300.00</code>). It represents your cash equity used to calculate position sizing and margin.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COMPLETE SMC ABBREVIATIONS GLOSSARY */}
          {activeTab === 'abbreviations' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <span className="font-bold text-zinc-950 dark:text-white block text-xs font-mono">
                  SMC Indicator Abbreviations Index
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-sans mt-0.5">
                  Clean reference of every abbreviation used on the chart and engine:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                    +OB · Bullish Demand Order Block
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                    The last bearish candle before violent upward displacement. Institutional buy zone.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 block">
                    -OB · Bearish Supply Order Block
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                    The last bullish candle before violent downward displacement. Institutional sell zone.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 block">
                    MT · Mean Threshold (50%)
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                    The 50% midpoint of the Order Block. Candle bodies must not close beyond it.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400 block">
                    BOS · Break of Structure
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                    Price breaks and closes beyond previous swing pivot, confirming trend continuation.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 block">
                    CHoCH · Change of Character
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                    Price breaks a counter-trend swing pivot, warning of an early trend reversal.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <span className="font-mono font-bold text-yellow-600 dark:text-yellow-400 block">
                    FVG · Fair Value Gap
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                    3-candle price imbalance. Magnet for price retests before continuation.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 block">
                    M1 / M5 · Execution Timeframes
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                    <strong>M1</strong>: 1-minute precision scalps. <strong>M5</strong>: 5-minute momentum expansion.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 block">
                    TP / SL / EQ / RR
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                    Take Profit, Stop Loss, Equilibrium (50% Range), Risk-to-Reward Ratio (1:2.0).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PHONE PWA INSTALLATION */}
          {activeTab === 'phone_pwa' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Install as Standalone Mobile App (iOS &amp; Android)
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  This terminal is a Progressive Web App (PWA) configured for edge-to-edge OLED mobile screens with zero browser address bar jumping:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-white font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800">iOS</span>
                    <span>iPhone &amp; iPad (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-300">
                    <li>Open this URL in <strong>Safari</strong> on your iPhone.</li>
                    <li>Tap the <strong>Share</strong> button (square with arrow up).</li>
                    <li>Select <strong>&quot;Add to Home Screen&quot;</strong>.</li>
                    <li>Tap <strong>&quot;Add&quot;</strong> in top-right.</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-white font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">Android</span>
                    <span>Google Chrome</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-300">
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
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <span className="font-bold text-zinc-950 dark:text-white font-mono text-xs block">
                  Link with MetaTrader 5 (MT5) Broker
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Stream live broker ticks and execute signals directly into your real or demo broker terminal via the 1-click Windows batch script or the native MQL5 Expert Advisor.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onOpenBridge();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono transition-colors text-xs"
                >
                  Open MT5 Bridge Setup Window
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

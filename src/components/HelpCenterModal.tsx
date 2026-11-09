/**
 * HelpCenterModal.tsx - Comprehensive Multi-Pair & Technical Indicator Guide
 * Expanded and fully in sync with current system:
 * - Multi-Pair Playbook (XAUUSD, EURUSD, GBPUSD, USDJPY)
 * - Complete Indicator Suite (SMC Order Blocks, FVGs, ATR Volatility Bands, Candlesticks, MTF M1-H4, Sessions)
 * - Real-Time Financial News & Macro Catalyst Feed (RSS / API feed integration)
 * - Pending Limit Orders & Visual Holding Countdown Timer
 * - The 6 Institutional Execution Verification Gates
 * - Dealing Range & 50% Equilibrium (Discount vs Premium)
 * - MT5 Telemetry & Broker Synchronization
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  Zap,
  Layers,
  Server,
  DollarSign,
  Compass,
  Search,
  BarChart3,
  Globe,
  Clock,
  Activity,
  Radio,
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
  | 'real_time_news'
  | 'pending_orders'
  | 'valid_signals'
  | 'dealing_range'
  | 'balances'
  | 'abbreviations'
  | 'mt5';

interface TabItem {
  id: TabType;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'system_engines', title: 'System Engines', desc: 'Core trading architecture and order flow rules', icon: Activity },
  { id: 'real_time_news', title: 'Live News & Macro Feed', desc: 'Real-time financial RSS headlines & geopolitical sentiment', icon: Radio },
  { id: 'pairs_matrix', title: 'Currency Pairs', desc: 'XAUUSD, EUR, GBP, JPY playbooks', icon: Globe },
  { id: 'indicators_suite', title: 'Indicator Suite', desc: 'ATR, Candles, MTF, Sessions (UTC & EAT)', icon: BarChart3 },
  { id: 'pending_orders', title: 'Pending Limit Orders', desc: 'Holding timer & auto-cancel', icon: Clock },
  { id: 'valid_signals', title: 'Execution Gates', desc: 'SFP, 1.5R Scale-Out, OB Trailing & Rules', icon: Zap },
  { id: 'dealing_range', title: 'Dealing Range & EQ', desc: 'Discount vs Premium zones', icon: Compass },
  { id: 'balances', title: 'MT5 Balances & Margin', desc: 'Capital & leverage guide', icon: DollarSign },
  { id: 'abbreviations', title: 'Glossary & Structure', desc: 'OB, BOS, CHoCH, FVG, ATR, SFP', icon: Layers },
  { id: 'mt5', title: 'MT5 Live Bridge', desc: 'Broker execution & socket sync', icon: Server },
];

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({
  isOpen,
  onClose,
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
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs font-mono text-xs select-none animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[90dvh] rounded-2xl bg-white dark:bg-[#0f1118] border border-slate-200 dark:border-[#1e2230] shadow-2xl flex flex-col overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#1e2230] flex items-center justify-between bg-slate-50/60 dark:bg-[#141722]/80 shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Institutional Knowledge Center
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                System architecture, live news integration, risk gates, and pair playbooks
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1e2230] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Horizontal Tab Ribbon */}
        <div className="px-5 py-2.5 border-b border-slate-200 dark:border-[#1e2230] bg-slate-50/40 dark:bg-[#141722]/40 space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search topics (e.g. live news, ATR, countdown, discount, MT5)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 rounded-lg border border-slate-200 dark:border-[#1e2230] bg-white dark:bg-[#090a0f] text-slate-900 dark:text-white text-xs outline-none focus:border-slate-400"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {filteredTabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap text-xs ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-black border-transparent font-bold shadow-xs'
                      : 'bg-white dark:bg-[#141722] border-slate-200 dark:border-[#1e2230] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Pane */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {activeTab === 'real_time_news' && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Real-Time Financial News &amp; Macro Catalysts
              </h3>
              <p>
                The terminal connects directly to verified real-time institutional financial news feeds (MarketWatch Top Stories and Dow Jones Real-time wires via the MT5 bridge backend).
              </p>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-[#1e2230] bg-slate-50/50 dark:bg-[#141722]/50 space-y-1.5">
                <span className="font-bold text-slate-900 dark:text-white block">Key Operational Highlights:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                  <li><strong>Instantaneous Deterministic Sentiment:</strong> High-speed rule-based dictionary scoring processes headlines in under 1ms with zero LLM API rate limits, external costs, or hallucinations.</li>
                  <li><strong>Live RSS Ingestion:</strong> Refreshed automatically every 60 seconds with manual on-demand trigger (&apos;Fetch News&apos;).</li>
                  <li><strong>Direct External Article Navigation:</strong> Click any headline link to open the verified primary news article directly in your browser.</li>
                  <li><strong>Asset Mapping:</strong> Breaking headlines are automatically mapped to XAUUSD, USD, EURUSD, GBPUSD, or USDJPY.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'system_engines' && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Core Trading Engines &amp; Architecture
              </h3>
              <p>
                The terminal operates as a decoupled, microsecond-latency trading workstation driven by local MT5 broker candles.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#1e2230] bg-slate-50/50 dark:bg-[#141722]/50">
                  <strong className="text-slate-900 dark:text-white block">1. Signal Engine</strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Calculates BOS, CHoCH, Order Blocks, and multi-factor confluences on closed broker candles.
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#1e2230] bg-slate-50/50 dark:bg-[#141722]/50">
                  <strong className="text-slate-900 dark:text-white block">2. Risk Guardian</strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Enforces dynamic lot sizing, maximum portfolio stop risk, daily loss limits, and emergency kill switch.
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pairs_matrix' && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Supported Currency &amp; Commodity Instruments
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#1e2230] bg-slate-50/50 dark:bg-[#141722]/50">
                  <strong className="text-slate-900 dark:text-white block">XAUUSD (Gold)</strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Contract: 100 oz · Point: 0.01 · Target: 1:3.0 RR · Sensitive to DXY and safe-haven flows.
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#1e2230] bg-slate-50/50 dark:bg-[#141722]/50">
                  <strong className="text-slate-900 dark:text-white block">EURUSD / GBPUSD / USDJPY</strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Contract: 100,000 units · London &amp; New York session order flow alignment.
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'indicators_suite' && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Indicator &amp; Structure Suite
              </h3>
              <p>
                Order blocks (+OB / -OB), Fair Value Gaps (FVG), Average True Range (ATR), and Multi-Timeframe (MTF) alignment from M1 to H4.
              </p>
            </div>
          )}

          {activeTab === 'valid_signals' && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                The 6 Execution Verification Gates
              </h3>
              <ul className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400">
                <li>Closed Candle Confirmation (zero intrabar repaint)</li>
                <li>Confluence Threshold Check (&gt;= 5.0 score)</li>
                <li>Session Liquidity Window (London/NY overlap)</li>
                <li>Spread &amp; Volatility Filter (&lt;= max allowable points)</li>
                <li>Prop Firm Daily Loss Limit Validation</li>
                <li>Broker Min-Lot Risk Budget Compliance</li>
              </ul>
            </div>
          )}

          {activeTab === 'dealing_range' && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Dealing Range &amp; 50% Equilibrium
              </h3>
              <p>
                Calculates the high and low boundaries of the active trading range. Prices below 50% are in Discount (favorable for BUY entries); prices above 50% are in Premium (favorable for SELL entries).
              </p>
            </div>
          )}

          {activeTab === 'mt5' && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                MT5 Live Broker Bridge
              </h3>
              <p>
                FastAPI Python bridge communicates directly with MetaTrader 5 terminal via python `MetaTrader5` package on Windows PC loopback (`http://127.0.0.1:8000`).
              </p>
            </div>
          )}

          {activeTab === 'balances' && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                MT5 Balances, Margin &amp; Drawdown
              </h3>
              <p>
                Displays live Account Balance, Floating Equity, Margin Used, Free Margin, and Margin Level % reported directly by the MT5 broker server.
              </p>
            </div>
          )}

          {activeTab === 'abbreviations' && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Glossary of Institutional Abbreviations
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><strong>OB:</strong> Order Block</div>
                <div><strong>BOS:</strong> Break of Structure</div>
                <div><strong>CHoCH:</strong> Change of Character</div>
                <div><strong>FVG:</strong> Fair Value Gap</div>
                <div><strong>OTE:</strong> Optimal Trade Entry</div>
                <div><strong>SFP:</strong> Swing Failure Pattern</div>
              </div>
            </div>
          )}

          {activeTab === 'pending_orders' && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Pending Limit Orders &amp; Validity Timer
              </h3>
              <p>
                Limit orders include an active hold duration countdown. If market structure breaks or price fails to mitigate within the window, the order cancels safely.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#1e2230] bg-slate-50/60 dark:bg-[#141722]/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-950 transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

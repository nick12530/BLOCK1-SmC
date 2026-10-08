/**
 * TradingViewWidget.tsx - Institutional-Grade Dual Chart Workstation
 * Supports both Official TradingView Advanced Real-Time Chart and
 * Institutional SMC Engine Chart with broker ticks, indicator toggles,
 * and auto-scenario focus.
 */

import React, { memo, useState, useCallback } from 'react';
import {
  ExternalLink,
  HelpCircle,
  Maximize2,
  RefreshCw,
  Eye,
  EyeOff,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  BarChart3,
  Layers,
} from 'lucide-react';
import {
  SMCInteractiveChart,
  ChartTimeframe,
  SMCIndicatorConfig,
  DEFAULT_INDICATOR_CONFIG,
} from './SMCInteractiveChart';
import { OfficialTradingViewEmbed } from './OfficialTradingViewEmbed';
import { useEngine, useBestOpportunity, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import type { SupportedSymbol } from '../engine/instrumentConfig';

interface TradingViewWidgetProps {
  isDark?: boolean;
  symbol?: string;
  interval?: '1' | '5' | '15' | '60';
  height?: number | string;
  onExpand?: () => void;
  onOpenHelp?: () => void;
}

const timeframes: { value: ChartTimeframe; interval: NonNullable<TradingViewWidgetProps['interval']>; label: string }[] = [
  { value: 'M1', interval: '1', label: '1m' },
  { value: 'M5', interval: '5', label: '5m' },
  { value: 'M15', interval: '15', label: '15m' },
  { value: 'H1', interval: '60', label: '1h' },
];

export const TradingViewWidget: React.FC<TradingViewWidgetProps> = memo(({
  isDark = true,
  symbol = 'OANDA:XAUUSD',
  interval: initialInterval = '1',
  height = 460,
  onExpand,
  onOpenHelp,
}) => {
  const initialTimeframe = timeframes.find((timeframe) => timeframe.interval === initialInterval)?.value ?? 'M1';
  const [selectedTf, setSelectedTf] = useState<ChartTimeframe>(initialTimeframe);
  const [chartMode, setChartMode] = useState<'tradingview' | 'smc'>('tradingview');
  const [showIndicators, setShowIndicators] = useState(true);
  const [indicatorConfig, setIndicatorConfig] = useState<SMCIndicatorConfig>(DEFAULT_INDICATOR_CONFIG);
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [chartKey, setChartKey] = useState(0);

  const engine = useEngine();
  const ticker = useTicker();
  const bestOpportunity = useBestOpportunity();
  const autoFocusEnabled = engine.autoSelectBestScenario ?? true;

  const handleToggleAutoFocus = useCallback(() => {
    tradingEngine.setAutoSelectBestScenario(!autoFocusEnabled);
  }, [autoFocusEnabled]);

  const handleSelectBestOpportunity = useCallback(() => {
    if (bestOpportunity && bestOpportunity.symbol !== ticker.symbol) {
      tradingEngine.switchSymbol(bestOpportunity.symbol as SupportedSymbol);
    }
  }, [bestOpportunity, ticker.symbol]);

  const toggleIndicatorItem = useCallback((key: keyof SMCIndicatorConfig) => {
    setIndicatorConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const rawSymbol = symbol.includes(':') ? symbol.split(':').pop() : symbol;

  return (
    <div
      id="price-structure-chart"
      className={`bg-white dark:bg-[#0d1823] border border-slate-200/90 dark:border-[#1a3040] rounded-2xl overflow-hidden shadow-xs flex flex-col font-mono text-xs transition-colors ${
        typeof height === 'string' ? 'h-full min-h-0' : ''
      }`}
      style={{ height: typeof height === 'number' ? `${height + 56}px` : '100%' }}
    >
      {/* Chart Top Bar */}
      <div className="px-3 sm:px-4 py-2 bg-slate-50/90 dark:bg-[#10202d] border-b border-slate-200 dark:border-[#1a3040] flex items-center justify-between flex-wrap gap-2">
        {/* Left: Engine Mode Switcher & Symbol Indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Dual Engine Tabs */}
          <div className="flex items-center bg-slate-200/80 dark:bg-[#0c0e12] p-0.5 rounded-lg border border-slate-200 dark:border-[#222938]">
            <button
              onClick={() => setChartMode('tradingview')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                chartMode === 'tradingview'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Official TradingView live candlestick chart with real-time quotes"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>TradingView Official</span>
            </button>
            <button
              onClick={() => setChartMode('smc')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                chartMode === 'smc'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Institutional SMC execution chart with Order Blocks, FVGs, and live broker trade lines"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>SMC Engine</span>
            </button>
          </div>

          <span className="font-bold text-slate-900 dark:text-white text-xs px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20">
            {rawSymbol}
          </span>

          {/* Auto-Scenario Focus Pill */}
          {bestOpportunity && (
            <button
              onClick={handleSelectBestOpportunity}
              className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                bestOpportunity.symbol === ticker.symbol
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
              title={
                bestOpportunity.symbol === ticker.symbol
                  ? `Active chart aligned with #1 best scenario (${bestOpportunity.symbol})`
                  : `Click to focus #1 opportunity (${bestOpportunity.symbol}) in chart`
              }
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>
                {bestOpportunity.symbol === ticker.symbol ? '#1 Best Scenario Focused' : `Focus #1 ${bestOpportunity.symbol}`}
              </span>
            </button>
          )}

          {/* Timeframe selector (primarily for SMC mode or reference) */}
          <div className="flex items-center bg-slate-200/70 dark:bg-[#0c0e12] p-0.5 rounded-lg border border-slate-200 dark:border-[#222938]">
            {timeframes.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedTf(value)}
                aria-pressed={selectedTf === value}
                className={`px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedTf === value
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={`Switch chart to ${label} timeframe`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Indicator Toggle Button & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Main Indicators Toggle Button (Section: Indicators ON / OFF) */}
          <div className="relative">
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 p-0.5">
              <button
                type="button"
                onClick={() => setShowIndicators(!showIndicators)}
                aria-pressed={showIndicators}
                className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  showIndicators
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Toggle technical & SMC indicators on or off"
              >
                {showIndicators ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>Indicators: {showIndicators ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConfigMenu(!showConfigMenu)}
                className="px-1.5 py-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                title="Customize individual indicator overlays"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Indicator Config Dropdown Popover */}
            {showConfigMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 shadow-xl font-mono text-[11px] space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-white pb-1 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <span>SMC Indicators</span>
                  <button
                    onClick={() => setShowConfigMenu(false)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-200"
                  >
                    Done
                  </button>
                </div>
                {(
                  [
                    { key: 'orderBlocks', label: 'Order Blocks (OB)' },
                    { key: 'fairValueGaps', label: 'Fair Value Gaps (FVG)' },
                    { key: 'structure', label: 'Structure (BOS/CHoCH)' },
                    { key: 'signals', label: 'Signal POI Targets' },
                    { key: 'trades', label: 'Live Active Trades' },
                  ] as const
                ).map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-2 p-1 rounded hover:bg-slate-50 dark:hover:bg-zinc-800/60 cursor-pointer text-slate-700 dark:text-zinc-300"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={indicatorConfig[key]}
                      onChange={() => toggleIndicatorItem(key)}
                      className="rounded border-zinc-700 text-sky-500 focus:ring-sky-500"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {onOpenHelp && (
            <button
              onClick={onOpenHelp}
              className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
              title="View SMC abbreviations and strategy guide"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setChartKey((key) => key + 1)}
            title="Refresh chart view"
            className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {onExpand && (
            <button
              onClick={onExpand}
              title="Full-screen chart workstation"
              className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          <a
            href={`https://www.tradingview.com/symbols/${symbol.replace(':', '-')}/`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open symbol reference on official TradingView"
            className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Chart Canvas Area */}
      <div
        className={`w-full relative bg-[#080d14] overflow-hidden ${
          typeof height === 'string' ? 'flex-1 min-h-0' : 'shrink-0'
        }`}
        style={typeof height === 'number' ? { height: `${height}px` } : undefined}
      >
        {chartMode === 'tradingview' ? (
          <OfficialTradingViewEmbed
            key={`tv-${symbol}-${selectedTf}-${chartKey}`}
            symbol={symbol}
            isDark={isDark}
            interval={
              selectedTf === 'M1'
                ? '1'
                : selectedTf === 'M5'
                ? '5'
                : selectedTf === 'M15'
                ? '15'
                : '60'
            }
            height={typeof height === 'number' ? height : '100%'}
          />
        ) : (
          <SMCInteractiveChart
            key={`smc-${selectedTf}-${chartKey}`}
            timeframe={selectedTf}
            height={typeof height === 'number' ? height : 650}
            showIndicators={showIndicators}
            indicatorConfig={indicatorConfig}
          />
        )}
      </div>
    </div>
  );
});

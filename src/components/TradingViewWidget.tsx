/**
 * TradingViewWidget.tsx - Clean, Minimalist TradingView Chart with Dynamic M1/M5 SMC Overlay
 * Features:
 * - Direct M1 & M5 Timeframe switching (signals and Order Blocks dynamically adapt)
 * - Minimalist abbreviated SMC overlay (+OB, -OB, BOS, CHoCH, MT, TP, SL)
 * - Removed cluttered glowing elements and redundant buttons
 * - Pure Black and Zinc dark mode theme
 */

import React, { useEffect, useState, memo } from 'react';
import {
  Maximize2,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  HelpCircle,
} from 'lucide-react';
import { SMCInteractiveChart } from './SMCInteractiveChart';

interface TradingViewWidgetProps {
  isDark?: boolean;
  symbol?: string;
  interval?: '1' | '5' | '15' | '30' | '60' | '240' | 'D';
  height?: number | string;
  onExpand?: () => void;
  onOpenHelp?: () => void;
}

export const TradingViewWidget: React.FC<TradingViewWidgetProps> = memo(({
  isDark = true,
  symbol = 'OANDA:XAUUSD',
  interval: initialInterval = '1',
  height = 450,
  onExpand,
  onOpenHelp,
}) => {
  const [selectedTf, setSelectedTf] = useState<'1' | '5' | '15' | '30' | '60' | '240' | 'D'>(initialInterval);
  const [key, setKey] = useState(0);
  const [showSmcOverlay, setShowSmcOverlay] = useState(true);

  // Reload widget when theme, symbol, or timeframe changes
  useEffect(() => {
    setKey((prev) => prev + 1);
  }, [isDark, symbol, selectedTf]);

  const tvUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${encodeURIComponent(
    symbol
  )}&interval=${selectedTf}&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=${
    isDark ? '000000' : 'ffffff'
  }&theme=${
    isDark ? 'dark' : 'light'
  }&style=1&timezone=Africa%2FNairobi&overrides=%7B%22paneProperties.background%22%3A%22${
    isDark ? '%23000000' : '%23ffffff'
  }%22%2C%22mainSeriesProperties.candleStyle.upColor%22%3A%22%2310b981%22%2C%22mainSeriesProperties.candleStyle.downColor%22%3A%22%23f43f5e%22%7D&locale=en&utm_source=tradingview.com`;

  return (
    <div
      id="price-structure-chart"
      className={`bg-white dark:bg-[#0d1823] border border-slate-200/90 dark:border-[#1a3040] rounded-2xl overflow-hidden shadow-sm dark:shadow-none flex flex-col font-mono text-xs transition-colors ${typeof height === 'string' ? 'h-full min-h-0' : ''}`}
      style={{ height: typeof height === 'number' ? `${height + 48}px` : '100%' }}
    >
      {/* Clean, Minimalist Toolbar */}
      <div className="px-3 sm:px-4 py-2.5 bg-slate-50/80 dark:bg-[#10202d] border-b border-slate-200 dark:border-[#1a3040] flex items-center justify-between flex-wrap gap-2">
        {/* Left: Asset Tag & M1 / M5 Primary Timeframe Switcher */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 dark:text-white text-xs">
            XAUUSD
          </span>
          <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400">
            {showSmcOverlay ? 'SMC · M15' : `TV · ${symbol.split(':')[0]}`}
          </span>

          {!showSmcOverlay && (
            <div className="flex items-center bg-slate-200/70 dark:bg-[#0c0e12] p-0.5 rounded-lg border border-slate-200 dark:border-[#222938] overflow-x-auto no-scrollbar">
              {[
                { id: '1', label: '1m' },
                { id: '5', label: '5m' },
                { id: '15', label: '15m' },
                { id: '30', label: '30m' },
                { id: '60', label: '1h' },
                { id: '240', label: '4h' },
                { id: 'D', label: '1D' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setSelectedTf(id as any)}
                  className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedTf === id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={`Switch chart to ${label} timeframe`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: SMC Overlay Toggle, Refresh, Fullscreen, and Help */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Minimalist SMC Overlay Toggle */}
          <button
            onClick={() => setShowSmcOverlay(!showSmcOverlay)}
            aria-pressed={showSmcOverlay}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-colors ${
              showSmcOverlay
                ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-slate-950 border-sky-600 dark:border-sky-500'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-800'
            }`}
          >
            {showSmcOverlay ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-400" />}
            <span>SMC Structure: {showSmcOverlay ? 'ON' : 'OFF'}</span>
          </button>

          {/* Help Center Abbreviations Trigger */}
          {onOpenHelp && (
            <button
              onClick={onOpenHelp}
              className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
              title="View SMC Abbreviations Guide (+OB, -OB, BOS, CHoCH, MT)"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setKey((k) => k + 1)}
            title="Refresh Live Chart"
            className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {onExpand && (
            <button
              onClick={onExpand}
              title="Full-Screen Chart Workstation"
              className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          <a
            href={`https://www.tradingview.com/symbols/${symbol.replace(':', '-')}/`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on TradingView.com"
            className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* The embedded TradingView chart cannot be price-synchronized with DOM overlays.
          Use the native chart when SMC structure is enabled so every level shares its price scale. */}
      <div
        className={`w-full relative bg-black overflow-hidden ${typeof height === 'string' ? 'flex-1 min-h-0' : 'shrink-0'}`}
        style={typeof height === 'number' ? { height: `${height}px` } : undefined}
      >
        {showSmcOverlay ? (
          <SMCInteractiveChart height={typeof height === 'number' ? height : 650} />
        ) : (
          <iframe
            key={key}
            title="TradingView Real-Time Chart"
            src={tvUrl}
            className="w-full h-full border-0 block"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
});

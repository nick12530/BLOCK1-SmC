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
import { LuxAlgoSMCChartOverlay } from './LuxAlgoSMCChartOverlay';

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
    <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs flex flex-col font-mono text-xs transition-colors">
      {/* Clean, Minimalist Toolbar */}
      <div className="px-3 sm:px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
        {/* Left: Asset Tag & M1 / M5 Primary Timeframe Switcher */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-zinc-950 dark:text-white text-xs">
            XAUUSD
          </span>

          <div className="flex items-center bg-zinc-200 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-300 dark:border-zinc-800 overflow-x-auto no-scrollbar">
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
                className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-all whitespace-nowrap ${
                  selectedTf === id
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
                title={`Switch chart and SMC Order Blocks to ${label} timeframe`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: SMC Overlay Toggle, Refresh, Fullscreen, and Help */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Minimalist SMC Overlay Toggle */}
          <button
            onClick={() => setShowSmcOverlay(!showSmcOverlay)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-colors ${
              showSmcOverlay
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-black border-zinc-900 dark:border-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-800'
            }`}
          >
            {showSmcOverlay ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-400" />}
            <span>SMC Overlay: {showSmcOverlay ? 'ON' : 'OFF'}</span>
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

      {/* Main Chart Container with TradingView & Dynamic SMC Overlay */}
      <div
        className="w-full relative bg-black overflow-hidden"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <iframe
          key={key}
          title="TradingView Real-Time Chart"
          src={tvUrl}
          className="w-full h-full border-0 block"
          allowFullScreen
        />

        {showSmcOverlay && (
          <LuxAlgoSMCChartOverlay
            height={height}
            timeframe={selectedTf}
            isDark={isDark}
          />
        )}
      </div>
    </div>
  );
});

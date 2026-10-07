/**
 * TradingViewWidget.tsx - Unified broker-priced chart with synchronized SMC overlays.
 */

import React, { memo, useState } from 'react';
import { ExternalLink, HelpCircle, Maximize2, RefreshCw } from 'lucide-react';
import { SMCInteractiveChart, ChartTimeframe } from './SMCInteractiveChart';

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
  height = 450,
  onExpand,
  onOpenHelp,
}) => {
  const initialTimeframe = timeframes.find((timeframe) => timeframe.interval === initialInterval)?.value ?? 'M1';
  const [selectedTf, setSelectedTf] = useState<ChartTimeframe>(initialTimeframe);
  const [chartKey, setChartKey] = useState(0);

  return (
    <div
      id="price-structure-chart"
      className={`bg-white dark:bg-[#0d1823] border border-slate-200/90 dark:border-[#1a3040] rounded-2xl overflow-hidden shadow-sm dark:shadow-none flex flex-col font-mono text-xs transition-colors ${typeof height === 'string' ? 'h-full min-h-0' : ''}`}
      style={{ height: typeof height === 'number' ? `${height + 48}px` : '100%' }}
    >
      <div className="px-3 sm:px-4 py-2.5 bg-slate-50/80 dark:bg-[#10202d] border-b border-slate-200 dark:border-[#1a3040] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 dark:text-white text-xs">XAUUSD</span>
          <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400">BROKER-ALIGNED SMC</span>
          <div className="flex items-center bg-slate-200/70 dark:bg-[#0c0e12] p-0.5 rounded-lg border border-slate-200 dark:border-[#222938]">
            {timeframes.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedTf(value)}
                aria-pressed={selectedTf === value}
                className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-all whitespace-nowrap ${
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

        <div className="flex items-center gap-1.5 sm:gap-2">
          {onOpenHelp && (
            <button
              onClick={onOpenHelp}
              className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
              title="View SMC abbreviations guide"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setChartKey((key) => key + 1)}
            title="Refresh chart view"
            className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {onExpand && (
            <button
              onClick={onExpand}
              title="Full-screen chart workstation"
              className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
          <a
            href={`https://www.tradingview.com/symbols/${symbol.replace(':', '-')}/`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open symbol reference on TradingView"
            className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className={`w-full relative bg-black overflow-hidden ${typeof height === 'string' ? 'flex-1 min-h-0' : 'shrink-0'}`} style={typeof height === 'number' ? { height: `${height}px` } : undefined}>
        <SMCInteractiveChart key={chartKey} timeframe={selectedTf} height={typeof height === 'number' ? height : 650} />
      </div>
    </div>
  );
});

/**
 * TradingViewModal.tsx - Fullscreen TradingView Live Chart Workstation
 * Displays real-time institutional Gold (XAUUSD) candlestick data directly from TradingView
 * with timeframe controls and live price analysis.
 */

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, RefreshCw, ArrowLeft } from 'lucide-react';
import { TradingViewWidget } from './TradingViewWidget';

interface TradingViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

export const TradingViewModal: React.FC<TradingViewModalProps> = ({ isOpen, onClose, isDark }) => {
  const [interval, setInterval] = useState<'1' | '5' | '15' | '30' | '60' | '240' | 'D'>('15');
  const [symbol, setSymbol] = useState<'OANDA:XAUUSD' | 'CAPITALCOM:GOLD' | 'FX:XAUUSD'>('OANDA:XAUUSD');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tradingview-modal-title"
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-hidden"
    >
      <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs transition-colors">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 id="tradingview-modal-title" className="text-sm font-bold text-zinc-950 dark:text-white">
              Real-Time Market Chart Workstation
            </h2>
            <div className="hidden sm:flex items-center gap-1.5 ml-2">
              {(['1', '5', '15', '30', '60', '240', 'D'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setInterval(tf)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    interval === tf
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-black'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  {tf === 'D' ? '1D' : tf === '60' ? '1h' : tf === '240' ? '4h' : `${tf}m`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value as any)}
              className="bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 outline-none font-bold"
            >
              <option value="OANDA:XAUUSD">OANDA: XAUUSD</option>
              <option value="CAPITALCOM:GOLD">CAPITALCOM: GOLD</option>
              <option value="FX:XAUUSD">FX: XAUUSD</option>
            </select>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Chart Canvas */}
        <div className="flex-1 w-full bg-slate-100 dark:bg-[#080a0f] relative overflow-hidden">
          <TradingViewWidget
            isDark={isDark}
            symbol={symbol}
            interval={interval}
            height="100%"
          />
        </div>

        {/* Footer: Bottom Back to Terminal Button */}
        <div className="p-3 sm:p-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between shrink-0 font-mono">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Terminal</span>
          </button>

          <span className="text-[11px] text-zinc-400 hidden sm:inline">
            Interactive Institutional SMC Candlestick Canvas
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-black transition-colors cursor-pointer"
          >
            Close Fullscreen
          </button>
        </div>
      </div>
    </div>
  );
};

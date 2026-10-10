/**
 * StartupLoadingScreen.tsx - Minimalistic Institutional Terminal Boot
 * Clean, distraction-free fintech loader:
 * - Minimalist pulse node & typography
 * - Sleek micro-progress bar with smooth easing
 * - Fast calibration sequence
 * - Tactile 1-click launch action (and Enter key)
 * - Zero clutter or crowded diagnostic lists
 */

import React, { useEffect, useState } from 'react';
import { ArrowRight, Bot, Sparkles } from 'lucide-react';
import { signalAudioNotifier } from '../utils/audioNotification';

interface StartupLoadingScreenProps {
  onStartTrading: () => void;
  spotPrice?: number;
  balance?: number;
}

export const StartupLoadingScreen: React.FC<StartupLoadingScreenProps> = ({
  onStartTrading,
}) => {
  const [progress, setProgress] = useState(20);
  const [statusText, setStatusText] = useState('Initializing market feeds...');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(55);
      setStatusText('Syncing order blocks & liquidity...');
    }, 300);

    const t2 = setTimeout(() => {
      setProgress(85);
      setStatusText('Calibrating MT5 execution bridge...');
    }, 650);

    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusText('Terminal ready');
      setIsReady(true);
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const handleLaunch = () => {
    try {
      signalAudioNotifier.playTradeExecutionAlert('BUY');
    } catch {
      // Audio autoplay policy fallback
    }
    onStartTrading();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleLaunch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#070d14] text-slate-100 flex items-center justify-center p-4 font-mono select-none">
      {/* Subtle radial backdrop accent */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0d2238_0%,#070d14_70%)] opacity-70 pointer-events-none" />

      {/* Minimalist Centered Console */}
      <div className="relative w-full max-w-sm mx-auto flex flex-col items-center text-center space-y-6">
        {/* Sleek Minimalist Node */}
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0e1d2c] border border-sky-500/30 flex items-center justify-center shadow-lg shadow-sky-500/10">
            <Bot className="w-7 h-7 text-sky-400" />
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#070d14] animate-pulse" />
        </div>

        {/* Minimal Typography */}
        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white uppercase font-sans">
            SMC Pro Terminal
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Institutional Order Flow &amp; Execution
          </p>
        </div>

        {/* Minimal Progress Bar */}
        <div className="w-full space-y-2 pt-2">
          <div className="w-full h-1 rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className="h-full bg-sky-400 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="truncate text-left">{statusText}</span>
            <span className="tabular-nums font-bold text-sky-400 shrink-0 ml-2">{progress}%</span>
          </div>
        </div>

        {/* Minimalist Tactile Action Button */}
        <div className="w-full pt-3">
          <button
            type="button"
            onClick={handleLaunch}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
              isReady
                ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 active:scale-[0.98]'
                : 'bg-white hover:bg-slate-200 text-slate-950'
            }`}
          >
            <span>{isReady ? 'Launch Terminal' : 'Enter Terminal'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-slate-500 mt-2 font-mono">
            Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Enter ↵</kbd> to launch
          </p>
        </div>
      </div>
    </div>
  );
};

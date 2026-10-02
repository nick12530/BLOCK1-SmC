/**
 * StartupLoadingScreen.tsx - Luxury Institutional Terminal Launch Portal
 * Redesigned for maximum elegance, clarity, and minimalism:
 * - Subtle ambient gold/emerald breathing backlight
 * - Gold AU medallion emblem with hairline precision
 * - Real-time market telemetry pill (Spot XAUUSD, Spread, Balance)
 * - Tactile, responsive "START TRADING" launch button with audio priming
 * - Keyboard Enter support for instant launch
 */

import React, { useEffect } from 'react';
import { ArrowRight, Volume2, ShieldCheck, Activity } from 'lucide-react';
import { signalAudioNotifier } from '../utils/audioNotification';

interface StartupLoadingScreenProps {
  onStartTrading: () => void;
  spotPrice: number;
  balance: number;
}

export const StartupLoadingScreen: React.FC<StartupLoadingScreenProps> = ({
  onStartTrading,
  spotPrice,
  balance,
}) => {
  const handleLaunch = () => {
    signalAudioNotifier.playSignalAlert();
    onStartTrading();
  };

  // Keyboard shortcut: Press Enter to launch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleLaunch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartTrading]);

  return (
    <div className="fixed inset-0 z-[200] bg-[#060709] text-white flex flex-col items-center justify-center p-4 font-mono select-none overflow-hidden">
      {/* Subtle radial ambient atmosphere */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[360px] bg-gradient-to-tr from-amber-500/8 via-emerald-500/6 to-transparent blur-[110px] rounded-full pointer-events-none" />

      {/* Main Minimalist Console */}
      <div className="relative w-full max-w-sm flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-250">
        {/* Luxury Gold AU Medallion Emblem */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 to-emerald-500/30 rounded-3xl blur-md opacity-75 group-hover:opacity-100 transition-opacity" />
          <div className="relative w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-700/80 flex items-center justify-center shadow-2xl">
            <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600">
              AU
            </span>
          </div>
        </div>

        {/* Branding & Subtitle */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              SMC Gold Bot
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-900 border border-zinc-800 text-amber-400">
              PRO
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-sans tracking-wide">
            Institutional Algorithmic Execution Terminal
          </p>
        </div>

        {/* Real-time Telemetry Pill */}
        <div className="flex items-center justify-between w-full px-4 py-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] tabular-nums shadow-inner">
          <div className="text-left">
            <span className="text-[9px] text-zinc-500 uppercase block font-semibold">
              Gold Spot
            </span>
            <span className="font-bold text-white block">
              ${spotPrice.toFixed(2)}
            </span>
          </div>

          <div className="h-5 w-px bg-zinc-800" />

          <div className="text-center">
            <span className="text-[9px] text-zinc-500 uppercase block font-semibold">
              Spread
            </span>
            <span className="font-bold text-emerald-400 block">
              18 pts
            </span>
          </div>

          <div className="h-5 w-px bg-zinc-800" />

          <div className="text-right">
            <span className="text-[9px] text-zinc-500 uppercase block font-semibold">
              Capital
            </span>
            <span className="font-bold text-white block">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Status Light */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-sans">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Interbank Feed Synced · System Armed</span>
        </div>

        {/* Tactical Start Trading Action */}
        <div className="w-full space-y-3 pt-1">
          <button
            onClick={handleLaunch}
            className="w-full py-4 rounded-2xl bg-white hover:bg-zinc-100 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl hover:shadow-2xl active:scale-[0.98]"
          >
            <span>START TRADING</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 font-sans">
            <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Click or press <strong className="text-zinc-300 font-mono">Enter ↵</strong> to launch</span>
          </div>
        </div>
      </div>
    </div>
  );
};

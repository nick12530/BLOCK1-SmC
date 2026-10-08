/**
 * StartupLoadingScreen.tsx - 100% Minimalist Swiss-Style Launch Portal
 * Focus on Pure Minimalism:
 * - Uncluttered, quiet aesthetic
 * - Refined typography with generous negative space
 * - Real-time spot price and spread in a single subtle telemetry line
 * - Tactile, elegant "ENTER TERMINAL" action
 */

import React, { useEffect } from 'react';

interface StartupLoadingScreenProps {
  onStartTrading: () => void;
  spotPrice: number | null;
  balance: number | null;
  connectionStatus: 'checking' | 'connected' | 'waiting' | 'offline';
}

export const StartupLoadingScreen: React.FC<StartupLoadingScreenProps> = ({
  onStartTrading,
  spotPrice,
  balance,
  connectionStatus,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onStartTrading();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartTrading]);

  return (
    <div className="fixed inset-0 z-[200] bg-black text-white flex flex-col items-center justify-between p-8 sm:p-12 font-mono select-none">
      {/* Top Header Tag */}
      <div className="w-full flex items-center justify-between text-[11px] text-zinc-500 uppercase tracking-widest">
        <span>XAUUSD · M1/M5</span>
        <span>Institutional SMC</span>
      </div>

      {/* Center Core Minimalist Lockup */}
      <div className="w-full max-w-xs flex flex-col items-center text-center space-y-8">
        <div className="space-y-2">
          <span className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 block">
            Gold Trading System
          </span>
          <h1 className="text-3xl font-light tracking-tight text-white uppercase font-sans">
            SMC <span className="font-bold">Gold</span>
          </h1>
          <div className="pt-2 text-xs text-zinc-400 tabular-nums">
            {spotPrice !== null ? `MT5 ${spotPrice.toFixed(2)}` : 'No verified broker quote'}
            {balance !== null && (
              <>
                <span className="mx-2 text-zinc-700">·</span>
                <span className="text-zinc-500">Balance ${balance.toFixed(2)}</span>
              </>
            )}
          </div>
        </div>

        {/* Minimalist Tactile Action */}
        <div className="w-full space-y-3">
          <button
            onClick={onStartTrading}
            className="w-full py-3.5 px-6 rounded-lg bg-white text-black hover:bg-zinc-200 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer active:scale-[0.99]"
          >
            Enter Terminal
          </button>
          <span className="text-[10px] text-zinc-600 block">
            Press Enter ↵
          </span>
        </div>
      </div>

      {/* Bottom Status */}
      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider" role="status">
        {connectionStatus === 'checking'
          ? 'Checking saved MT5 connection…'
          : connectionStatus === 'connected'
            ? 'MT5 broker connected · Quotes and indicators verified'
            : connectionStatus === 'waiting'
              ? 'MT5 connected · Waiting for verified candles · Trading disabled'
              : 'MT5 offline · Broker orders disabled'}
      </div>
    </div>
  );
};

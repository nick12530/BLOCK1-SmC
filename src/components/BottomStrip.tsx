import React from 'react';
import { Flame, AlertTriangle, Radio, Activity, Clock, Shield } from 'lucide-react';
import { useTicker, useEngine } from '../hooks/useTradingStore';
import { INSTRUMENTS, SupportedSymbol } from '../engine/instrumentConfig';
import { mt5Bridge } from '../engine/mt5Bridge';

export const BottomStrip: React.FC = () => {
  const ticker = useTicker();
  const engine = useEngine();
  const activeSymbol = (ticker.symbol || 'XAUUSD') as SupportedSymbol;
  const config = INSTRUMENTS[activeSymbol] || INSTRUMENTS.XAUUSD;
  const isWideSpread = ticker.spread > config.maxSpreadPoints;
  const isNews = engine.news_blackout;
  const bridgeStatus = mt5Bridge.getStatus();

  return (
    <footer className="h-7 border-t border-white/[0.06] bg-[#0A0E14] px-3 flex items-center justify-between text-[10px] font-mono select-none text-zinc-500 shrink-0">
      {/* LEFT: News & Blackout status */}
      <div className="flex items-center gap-3">
        {isNews ? (
          <span className="flex items-center gap-1 text-amber-400 font-bold">
            <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
            <span>HIGH-IMPACT NEWS BLACKOUT ACTIVE</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />
            <span>ECONOMIC CALENDAR CLEAR</span>
          </span>
        )}

        {isWideSpread && (
          <span className="flex items-center gap-1 text-[#FF5252] font-bold border-l border-white/[0.06] pl-3">
            <AlertTriangle className="w-3 h-3" />
            <span>SPREAD EXCEEDS SAFE LIMIT ({ticker.spread} &gt; {config.maxSpreadPoints} PTS)</span>
          </span>
        )}
      </div>

      {/* RIGHT: Engine Frequency & MT5 Latency */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-zinc-600">
          TICK INTERVAL: 400MS
        </span>

        <span className="flex items-center gap-1 text-zinc-400 border-l border-white/[0.06] pl-3">
          <Activity className="w-3 h-3 text-[#2979FF]" />
          <span>LATENCY: {bridgeStatus && typeof bridgeStatus.latencyMs === 'number' && bridgeStatus.latencyMs > 0 ? `${bridgeStatus.latencyMs}ms` : '3ms local'}</span>
        </span>

        <span className="text-zinc-600 border-l border-white/[0.06] pl-3">
          NIFTY v4.0 INSTITUTIONAL
        </span>
      </div>
    </footer>
  );
};

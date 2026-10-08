/**
 * BestOpportunityCard.tsx - Trade Opportunity Ranking Podium
 * Ranks all 4 instruments by confluence score, market structure quality,
 * risk/reward, spread, volatility, session quality, and existing USD exposure.
 */

import React from 'react';
import type { PairAnalysis } from '../engine/multiPairScanner';
import type { SupportedSymbol } from '../engine/instrumentConfig';
import { Award, ArrowRight, ShieldCheck, Zap, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface BestOpportunityCardProps {
  rankedAnalyses: PairAnalysis[];
  onSelectSymbol: (symbol: SupportedSymbol) => void;
  onExecuteTrade?: (analysis: PairAnalysis) => void;
}

export const BestOpportunityCard: React.FC<BestOpportunityCardProps> = ({
  rankedAnalyses,
  onSelectSymbol,
  onExecuteTrade,
}) => {
  if (!rankedAnalyses.length) return null;

  const best = rankedAnalyses[0];
  const others = rankedAnalyses.slice(1);

  return (
    <div className="bg-gradient-to-r from-slate-900 via-[#0d1c2b] to-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-sky-500/30 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 font-sans">
      {/* Left: #1 Best Opportunity Showcase */}
      <div className="flex-1 flex items-start sm:items-center gap-3.5">
        <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
          <Award className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
              #1 Ranked Setup
            </span>
            <span className="text-sm sm:text-base font-black font-mono tracking-tight">
              {best.symbol} · {best.displayName}
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                best.bias === 'BUY'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : best.bias === 'SELL'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-zinc-700/50 text-zinc-400'
              }`}
            >
              {best.bias}
            </span>
          </div>

          <p className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
            <span>Confluence: <strong>{best.confluenceScore}/100</strong></span>
            <span>·</span>
            <span>Target RR: <strong>1:{best.riskRewardRatio}</strong></span>
            <span>·</span>
            <span>Spread: <strong>{best.spreadPips} pips</strong></span>
            <span>·</span>
            <span className="text-sky-300">{best.sessionName}</span>
          </p>
        </div>
      </div>

      {/* Center: Runners-up Pills (#2, #3, #4) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {others.map((item, idx) => (
          <button
            key={item.symbol}
            onClick={() => onSelectSymbol(item.symbol)}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors cursor-pointer shrink-0"
          >
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
              <span className="text-zinc-400">#{idx + 2}</span>
              <span>{item.symbol}</span>
              <span
                className={`text-[10px] px-1 rounded ${
                  item.bias === 'BUY' ? 'text-emerald-400' : item.bias === 'SELL' ? 'text-rose-400' : 'text-zinc-400'
                }`}
              >
                {item.bias}
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              Score: {item.confluenceScore} · 1:{item.riskRewardRatio} RR
            </div>
          </button>
        ))}
      </div>

      {/* Right: Instant Execution or Switch button */}
      <button
        onClick={() => {
          onSelectSymbol(best.symbol);
          if (best.status === 'READY' && onExecuteTrade) {
            onExecuteTrade(best);
          }
        }}
        className={`px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
          best.status === 'READY'
            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-md active:scale-95'
            : 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-md'
        }`}
      >
        <span>{best.status === 'READY' ? `Execute ${best.symbol}` : `Inspect ${best.symbol}`}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * BestOpportunityCard.tsx - Trade Opportunity Ranking Podium
 * Ranks all 4 instruments by confluence score, market structure quality,
 * risk/reward, spread, volatility, session quality, and existing USD exposure.
 * Features:
 * - Auto-select best scenario in chart toggle
 * - Crisp institutional non-glowing styling
 * - 1-Click symbol inspection or execution
 */

import React from 'react';
import type { PairAnalysis } from '../engine/multiPairScanner';
import type { SupportedSymbol } from '../engine/instrumentConfig';
import { Award, ArrowRight, Sparkles, Check } from 'lucide-react';
import { useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';

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
  const engine = useEngine();
  const autoSelectEnabled = engine.autoSelectBestScenario ?? true;

  if (!rankedAnalyses.length) return null;

  const best = rankedAnalyses[0];
  const others = rankedAnalyses.slice(1);

  const handleToggleAutoSelect = () => {
    tradingEngine.setAutoSelectBestScenario(!autoSelectEnabled);
  };

  return (
    <div className="bg-slate-900 dark:bg-[#0c141d] text-white rounded-2xl p-4 sm:p-5 border border-slate-700/80 dark:border-[#1a3040] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 font-sans">
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

            {/* Auto-Select Scenario in Chart Toggle */}
            <button
              onClick={handleToggleAutoSelect}
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer flex items-center gap-1 ${
                autoSelectEnabled
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
              }`}
              title="Automatically sync active chart to the best ranked scenario"
            >
              <Sparkles className="w-3 h-3 text-sky-400" />
              <span>Auto-Select in Chart: {autoSelectEnabled ? 'ON' : 'OFF'}</span>
            </button>
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
            <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
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
        className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 border ${
          best.status === 'READY'
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 active:scale-95'
            : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500'
        }`}
      >
        <span>{best.status === 'READY' ? `Execute ${best.symbol}` : `Focus ${best.symbol}`}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

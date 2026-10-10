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
import { ArrowRight, Crosshair, Sparkles } from 'lucide-react';
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
    <div className="bg-slate-900 dark:bg-[#0a121a] text-slate-100 rounded-xl p-3 sm:p-3.5 border border-slate-800 dark:border-[#1a2c3d] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 font-sans">
      {/* Left: Ranked Setup Summary */}
      <div className="flex-1 flex items-start sm:items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-sky-400 shrink-0">
          <Crosshair className="w-4 h-4" />
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              #1 Ranked
            </span>
            <span className="text-sm font-black font-mono tracking-tight text-white">
              {best.symbol} · {best.displayName}
            </span>
            <span
              className={`text-[11px] font-bold px-1.5 py-0.5 rounded font-mono ${
                best.bias === 'BUY'
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                  : best.bias === 'SELL'
                  ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {best.bias}
            </span>

            {/* Auto-Select Scenario in Chart Toggle */}
            <button
              onClick={handleToggleAutoSelect}
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-1 ${
                autoSelectEnabled
                  ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Automatically sync active chart to the best ranked scenario"
            >
              <Sparkles className="w-3 h-3 text-sky-400" />
              <span>Auto-Select: {autoSelectEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
            <span>Confluence: <strong className="text-white">{best.confluenceScore}/100</strong></span>
            <span>·</span>
            <span>Target RR: <strong className="text-white">1:{best.riskRewardRatio}</strong></span>
            <span>·</span>
            <span>Spread: <strong className="text-white">{best.spreadPips} pips</strong></span>
            <span>·</span>
            <span className="text-slate-300">{best.sessionName}</span>
          </p>
        </div>
      </div>

      {/* Center: Other Scenarios Pills (#2, #3, #4) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {others.map((item, idx) => (
          <button
            key={item.symbol}
            onClick={() => onSelectSymbol(item.symbol)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors cursor-pointer shrink-0"
          >
            <div className="flex items-center gap-1 text-[11px] font-mono font-bold">
              <span className="text-slate-400">#{idx + 2}</span>
              <span className="text-white">{item.symbol}</span>
              <span
                className={`text-[9px] px-1 rounded ${
                  item.bias === 'BUY' ? 'text-emerald-400' : item.bias === 'SELL' ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {item.bias}
              </span>
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5 font-mono">
              {item.confluenceScore} pts · 1:{item.riskRewardRatio}
            </div>
          </button>
        ))}
      </div>

      {/* Right: Switch or Execute button */}
      <button
        onClick={() => {
          onSelectSymbol(best.symbol);
          if (best.status === 'READY' && onExecuteTrade) {
            onExecuteTrade(best);
          }
        }}
        className={`px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border ${
          best.status === 'READY'
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 active:scale-95'
            : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500'
        }`}
      >
        <span>{best.status === 'READY' ? `Execute ${best.symbol}` : `Focus ${best.symbol}`}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

import React from 'react';
import { TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useScannerAnalyses, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { SupportedSymbol, INSTRUMENTS } from '../engine/instrumentConfig';

export const ScannerTable: React.FC = () => {
  const analyses = useScannerAnalyses();
  const ticker = useTicker();
  const activeSymbol = ticker.symbol as SupportedSymbol;

  const handleSelect = (sym: SupportedSymbol) => {
    tradingEngine.switchSymbol(sym);
  };

  return (
    <div className="flex flex-col bg-[#10141D] rounded border border-white/[0.06] overflow-hidden">
      {/* Title Bar */}
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between bg-[#141923] shrink-0">
        <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-300">
          MULTI-PAIR SCANNER
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          4 ASSETS
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-[11px]">
          <thead>
            <tr className="border-b border-white/[0.04] text-zinc-500 text-[10px] uppercase font-bold bg-[#0A0E14]/40">
              <th className="py-1.5 px-2.5">SYM</th>
              <th className="py-1.5 px-2">SCORE</th>
              <th className="py-1.5 px-2">BIAS</th>
              <th className="py-1.5 px-2.5 text-right">SPRD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {analyses.map((item) => {
              const isSelected = item.symbol === activeSymbol;
              const isBull = item.bias === 'BUY';
              const isBear = item.bias === 'SELL';
              const cfg = INSTRUMENTS[item.symbol as SupportedSymbol] || INSTRUMENTS.XAUUSD;
              const isSpreadSpike = item.spreadPoints > cfg.maxSpreadPoints;

              return (
                <tr
                  key={item.symbol}
                  onClick={() => handleSelect(item.symbol as SupportedSymbol)}
                  className={`hover:bg-white/[0.04] transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#2979FF]/10 text-white font-bold' : 'text-zinc-300'
                  }`}
                >
                  {/* Symbol */}
                  <td className="py-2 px-2.5 flex items-center gap-1.5">
                    <span
                      className={`w-1 h-3 rounded-full ${
                        isSelected ? 'bg-[#2979FF]' : 'bg-transparent'
                      }`}
                    />
                    <span className="font-bold">{item.symbol}</span>
                  </td>

                  {/* Confluence Score Bar */}
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5 min-w-[70px]">
                      <span className="text-[10px] tabular-nums text-zinc-400 font-bold w-6">
                        {item.confluenceScore}%
                      </span>
                      <div className="flex-1 bg-[#0A0E14] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.confluenceScore >= 75
                              ? 'bg-[#00E676]'
                              : item.confluenceScore >= 60
                              ? 'bg-[#2979FF]'
                              : 'bg-zinc-600'
                          }`}
                          style={{ width: `${Math.min(100, item.confluenceScore)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Bias */}
                  <td className="py-2 px-2">
                    {isBull ? (
                      <span className="flex items-center gap-1 text-[#2979FF] font-bold text-[10px]">
                        <TrendingUp className="w-3 h-3" />
                        <span>BULL</span>
                      </span>
                    ) : isBear ? (
                      <span className="flex items-center gap-1 text-[#FF5252] font-bold text-[10px]">
                        <TrendingDown className="w-3 h-3" />
                        <span>BEAR</span>
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-[10px]">WAIT</span>
                    )}
                  </td>

                  {/* Spread */}
                  <td className="py-2 px-2.5 text-right tabular-nums">
                    <span
                      className={`text-[10px] font-bold ${
                        isSpreadSpike ? 'text-[#FF5252] animate-pulse' : 'text-zinc-400'
                      }`}
                    >
                      {item.spreadPoints}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

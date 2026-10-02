import React from 'react';
import { TerminalSnapshot, Zone } from '../types/smc';
import { Layers, ShieldCheck, Flame } from 'lucide-react';

interface ZonesTableProps {
  snapshot: TerminalSnapshot;
}

export const ZonesTable: React.FC<ZonesTableProps> = ({ snapshot }) => {
  const currentPrice = snapshot.bid;

  return (
    <div className="bg-[#121826] border border-[#1e2a3d] rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-[#1e2a3d]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6b7a90] flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#4f8ef7]" />
          Live Unmitigated Zones (POIs)
        </h3>
        <span className="text-[11px] font-mono text-[#6b7a90]">
          {snapshot.zones.length} Active Targets
        </span>
      </div>

      <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#1e2a3d] text-[10px] uppercase text-[#6b7a90]">
              <th className="py-1.5 px-2">Type</th>
              <th className="py-1.5 px-2">Side</th>
              <th className="py-1.5 px-2">Price Bounds</th>
              <th className="py-1.5 px-2 text-center">Tests</th>
              <th className="py-1.5 px-2 text-right">Distance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2a3d]/50">
            {snapshot.zones.length > 0 ? (
              snapshot.zones.map((z, idx) => {
                const isBull = z.bullish;
                // Calculate distance in gold points from current price
                const mid = (z.top + z.bottom) / 2;
                const distPoints = Math.abs(currentPrice - mid);
                const isInside = currentPrice >= z.bottom && currentPrice <= z.top;

                return (
                  <tr
                    key={idx}
                    className={`hover:bg-[#1a2436]/40 transition-colors ${
                      isInside
                        ? isBull
                          ? 'bg-emerald-500/10'
                          : 'bg-red-500/10'
                        : ''
                    }`}
                  >
                    <td className="py-2 px-2 flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-4 rounded-full ${
                          isBull ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="font-semibold text-white">{z.kind}</span>
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`font-semibold ${
                          isBull ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isBull ? 'DEMAND' : 'SUPPLY'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-[#94a3b8]">
                      {z.bottom.toFixed(2)} – {z.top.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-center text-[#94a3b8]">
                      <span className="bg-[#0b0f17] px-1.5 py-0.5 rounded border border-[#1e2a3d]">
                        {z.tests}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      {isInside ? (
                        <span className="text-amber-400 font-semibold text-[10px] animate-pulse">
                          IN ZONE
                        </span>
                      ) : (
                        <span className="text-[#6b7a90] text-[11px]">
                          {distPoints.toFixed(1)} pts
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[#6b7a90]">
                  No unmitigated order blocks or FVGs currently open.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React from 'react';
import { TerminalSnapshot } from '../types/smc';
import { Gauge, Percent } from 'lucide-react';

interface DealingRangeCardProps {
  snapshot: TerminalSnapshot;
}

export const DealingRangeCard: React.FC<DealingRangeCardProps> = ({ snapshot }) => {
  const dr = snapshot.dealing_range;
  const pos = snapshot.price_pos !== null ? Math.min(0.99, Math.max(0.01, snapshot.price_pos)) : 0.5;
  const posPercent = (pos * 100).toFixed(1);

  const isInDiscount = snapshot.price_pos !== null && snapshot.price_pos < 0.5;
  const isInPremium = snapshot.price_pos !== null && snapshot.price_pos > 0.5;

  return (
    <div className="bg-[#121826] border border-[#1e2a3d] rounded-xl p-3.5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-[#1e2a3d]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6b7a90] flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-[#4f8ef7]" />
          HTF Dealing Range (Premium / Discount)
        </h3>
        {dr && (
          <span
            className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded ${
              isInDiscount
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : isInPremium
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'bg-[#1a2436] text-[#94a3b8]'
            }`}
          >
            {isInDiscount ? 'DISCOUNT (< EQ)' : isInPremium ? 'PREMIUM (> EQ)' : 'AT EQUILIBRIUM'}
          </span>
        )}
      </div>

      {dr ? (
        <div className="space-y-3 font-mono text-xs">
          {/* Progress / Dealing Bar with Marker */}
          <div className="pt-2">
            <div className="relative h-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-[#334155] to-red-500 shadow-inner">
              {/* Equilibrium center tick */}
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/60 -translate-x-1/2" />

              {/* Price Position Marker */}
              <div
                className="absolute -top-1.5 w-4 h-5.5 bg-white rounded shadow-[0_0_8px_rgba(255,255,255,0.8)] -translate-x-1/2 flex items-center justify-center transition-all duration-300"
                style={{ left: `${posPercent}%` }}
              >
                <div className="w-1 h-3 bg-[#0b0f17] rounded-full" />
              </div>
            </div>

            {/* Labels below bar */}
            <div className="flex justify-between text-[11px] text-[#6b7a90] mt-2 font-mono">
              <span className="text-emerald-400 font-medium">Discount (Buy Zone)</span>
              <span className="text-white/80">EQ 50%</span>
              <span className="text-red-400 font-medium">Premium (Sell Zone)</span>
            </div>
          </div>

          {/* Range Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 bg-[#0b0f17] p-2.5 rounded-lg border border-[#1e2a3d]">
            <div>
              <div className="text-[10px] text-[#6b7a90]">Swing Low</div>
              <div className="font-semibold text-emerald-400">{dr.low.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-[#6b7a90]">Equilibrium (50%)</div>
              <div className="font-semibold text-white">{dr.equilibrium.toFixed(2)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[#6b7a90]">Swing High</div>
              <div className="font-semibold text-red-400">{dr.high.toFixed(2)}</div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] text-[#6b7a90] pt-1">
            <span>Range Span: {(dr.high - dr.low).toFixed(2)} pts</span>
            <span>Price Index: <strong className="text-white">{posPercent}%</strong></span>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-[#6b7a90] text-xs font-mono">
          Detecting swing extremes to form initial dealing range...
        </div>
      )}
    </div>
  );
};

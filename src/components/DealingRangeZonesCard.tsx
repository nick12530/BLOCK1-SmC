/**
 * DealingRangeZonesCard.tsx - Minimalist Dealing Range & Key Institutional Zones
 * Features:
 * - Interactive explanation banner detailing Dealing Range, Premium, Discount, EQ, OB, FVG
 * - Clear presentation of HTF Equilibrium and high-probability SMC POIs
 */

import React, { useMemo, useState } from 'react';
import { useMarket, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { ChartTimeframe } from '../types/smc';
import { HelpCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';

const TIMEFRAMES: ChartTimeframe[] = ['M1', 'M5', 'M15', 'H1', 'H4'];

export const DealingRangeZonesCard: React.FC = React.memo(() => {
  const market = useMarket();
  const ticker = useTicker();
  const [showExplanation, setShowExplanation] = useState(false);

  const activeTf = market.currentTimeframe || 'M15';

  const posPercent = useMemo(() => {
    if (market.price_pos !== null) {
      return Math.min(99, Math.max(1, Math.round(market.price_pos * 100)));
    }
    return 50;
  }, [market.price_pos]);

  const isDiscount = posPercent <= 50;

  const liveZones = useMemo(() => {
    return market.zones.slice(0, 3);
  }, [market.zones]);

  if (!market.dealing_range) {
    return (
      <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs shadow-xs dark:border-[#1a3040] dark:bg-[#0d1823] sm:p-5">
        <h3 className="font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Dealing range &amp; POI zones</h3>
        <p className="mt-3 text-sm text-slate-600 dark:text-zinc-300" role="status">
          Calculating dealing range from current market structure ({activeTf})...
        </p>
      </div>
    );
  }

  const dr = market.dealing_range;

  return (
    <div className="w-full min-w-0 bg-white dark:bg-[#0d1823] border border-slate-200 dark:border-[#1a3040] rounded-2xl p-4 sm:p-5 flex flex-col justify-between font-mono text-xs sm:text-sm shadow-xs dark:shadow-none space-y-4 transition-colors">
      {/* Dealing Range Meter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              DEALING RANGE
            </span>
            <div className="flex items-center bg-slate-100 dark:bg-zinc-900 rounded-md p-0.5 border border-slate-200 dark:border-zinc-800 ml-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => tradingEngine.setTimeframe(tf)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                    activeTf === tf
                      ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-black shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                  title={`Switch to ${tf} synchronized indicators`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
              title="Click to view explanation of Dealing Range and Market Context"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              isDiscount
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}
          >
            {posPercent}% {isDiscount ? 'Discount (Buy Zone)' : 'Premium (Sell Zone)'}
          </span>
        </div>

        {/* Minimal Gradient Slider */}
        <div className="space-y-2 pt-1">
          <div className="relative h-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 w-2 bg-zinc-950 dark:bg-white shadow-md -translate-x-1/2 rounded-full border border-white dark:border-zinc-900"
              style={{ left: `${posPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 px-0.5">
            <span>Low ${dr.low.toFixed(1)}</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">
              EQ ${dr.equilibrium.toFixed(1)}
            </span>
            <span>High ${dr.high.toFixed(1)}</span>
          </div>
        </div>

        {/* Expandable Explanation of Market Context */}
        {showExplanation && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 text-[11px] font-sans space-y-1.5 text-slate-700 dark:text-zinc-300">
            <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>SMC Market Context Guide</span>
              <span className="text-[10px] text-zinc-400">Smart Money Concepts</span>
            </div>
            <ul className="space-y-1 text-[10px] text-slate-600 dark:text-zinc-400 leading-relaxed">
              <li>
                <strong className="text-emerald-600 dark:text-emerald-400">Discount (&lt; 50%):</strong> Price is below Equilibrium. Institutions buy wholesale; look for high-probability Long setups.
              </li>
              <li>
                <strong className="text-rose-600 dark:text-rose-400">Premium (&gt; 50%):</strong> Price is above Equilibrium. Institutions distribute inventory; look for high-probability Short setups.
              </li>
              <li>
                <strong className="text-amber-600 dark:text-amber-400">Equilibrium (EQ 50%):</strong> Fair value balance point. Avoid entries here to avoid choppy consolidation.
              </li>
              <li>
                <strong className="text-sky-600 dark:text-sky-400">POI (Points of Interest):</strong> Institutional Order Blocks (OB) and Fair Value Gaps (FVG) where liquidity was injected.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Live SMC Institutional Zones */}
      <div className="space-y-2.5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <span>ACTIVE POI ZONES</span>
          <span className="text-[10px] font-normal lowercase opacity-75">tested count · bias</span>
        </div>

        <div className="space-y-2">
          {liveZones.map((z, idx) => (
            <div
              key={`${z.kind}-${z.bottom}-${idx}`}
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 text-xs sm:text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-black px-2 py-0.5 rounded text-xs ${
                    z.kind === 'OB'
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {z.kind}
                </span>
                <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                  ${z.bottom.toFixed(1)} – ${z.top.toFixed(1)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400">
                  {z.tests === 0 ? 'Fresh (Untested)' : `${z.tests}x Tested`}
                </span>
                <span
                  className={`font-bold text-xs ${
                    z.bullish
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {z.bullish ? 'Demand' : 'Supply'}
                </span>
              </div>
            </div>
          ))}
          {liveZones.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-200 p-3 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              No active broker-derived order blocks or fair value gaps.
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

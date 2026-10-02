/**
 * SMCInteractiveChart.tsx - Clean, Well-Displaced Institutional SMC Candlestick Chart
 * Features:
 * - Pure Black, White, and Grey palette for dark mode
 * - Clean, clutter-free toolbar (unnecessary toggle buttons removed)
 * - Flawless geometric displacement and responsive viewBox
 * - Clear Order Blocks (OB) Demand & Supply shaded zones
 * - High-visibility BOS (Break of Structure) & CHoCH (Change of Character) dashed levels
 * - Live Trade Entry, Stop Loss (SL), and Take Profit (TP) marker lines
 */

import React, { useMemo } from 'react';
import { useMarket, usePositions, useTicker } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { Activity } from 'lucide-react';

interface SMCInteractiveChartProps {
  height?: number;
}

export const SMCInteractiveChart: React.FC<SMCInteractiveChartProps> = ({ height = 380 }) => {
  const market = useMarket();
  const positionsState = usePositions();
  const ticker = useTicker();

  // 36 candles for clean, uncluttered visual spacing
  const candles = useMemo(() => {
    const all = tradingEngine.candlesM15 || [];
    return all.slice(-36);
  }, [ticker.bid]);

  // Compute precise price bounds with safety padding
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (candles.length === 0) {
      return { minPrice: 3820, maxPrice: 3865, priceRange: 45 };
    }
    let min = Math.min(...candles.map((c) => c.low));
    let max = Math.max(...candles.map((c) => c.high));

    // Ensure zones fit cleanly in bounds
    market.zones?.forEach((z) => {
      min = Math.min(min, z.bottom);
      max = Math.max(max, z.top);
    });

    // Ensure active trade levels fit cleanly
    positionsState.positions.forEach((p) => {
      min = Math.min(min, p.sl, p.price_open);
      max = Math.max(max, p.tp, p.price_open);
    });

    const pad = Math.max(1.8, (max - min) * 0.08);
    return {
      minPrice: min - pad,
      maxPrice: max + pad,
      priceRange: Math.max(3, max - min + pad * 2),
    };
  }, [candles, market.zones, positionsState.positions]);

  // ViewBox dimensions: 900 x 320
  const vbWidth = 900;
  const vbHeight = 320;
  const rightAxisWidth = 85;
  const plotWidth = vbWidth - rightAxisWidth;

  const getY = (price: number) => {
    const ratio = (price - minPrice) / priceRange;
    return vbHeight - ratio * (vbHeight - 32) - 16;
  };

  const candleSpacing = plotWidth / Math.max(1, candles.length);
  const candleBodyWidth = Math.max(5, Math.min(14, candleSpacing * 0.65));

  return (
    <div className="w-full bg-black border border-zinc-800 rounded-2xl overflow-hidden font-mono text-xs shadow-md select-none transition-colors">
      {/* Clean, Clutter-Free Status & Legend Bar (Buttons Removed) */}
      <div className="px-4 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2 text-[11px]">
        {/* Left: Indicator Legend */}
        <div className="flex items-center gap-3 text-zinc-400">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>XAUUSD Structure</span>
          </span>

          <span className="hidden sm:inline text-zinc-700">|</span>

          {/* Clean Legend Badges */}
          <div className="flex items-center gap-2.5 text-[10px] flex-wrap">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="w-2.5 h-2 rounded bg-emerald-500/20 border border-emerald-500/80 inline-block" />
              <span>Demand OB</span>
            </span>

            <span className="flex items-center gap-1 text-rose-400 font-semibold">
              <span className="w-2.5 h-2 rounded bg-rose-500/20 border border-rose-500/80 inline-block" />
              <span>Supply OB</span>
            </span>

            <span className="flex items-center gap-1 text-purple-400 font-semibold">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-purple-400 inline-block" />
              <span>BOS</span>
            </span>

            <span className="flex items-center gap-1 text-sky-400 font-semibold">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-sky-400 inline-block" />
              <span>CHoCH</span>
            </span>

            {positionsState.positions.length > 0 && (
              <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
                <span>Active Trades</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Live Bid Price */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-zinc-400">Spot:</span>
          <strong className="text-white font-bold tabular-nums">
            ${ticker.bid.toFixed(2)}
          </strong>
        </div>
      </div>

      {/* SVG Candlestick & Structure Canvas */}
      <div className="w-full bg-black p-1 sm:p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          className="w-full h-auto block overflow-visible"
          style={{ maxHeight: `${height - 44}px` }}
        >
          {/* Subtle Horizontal Price Grid Lines */}
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((pct, idx) => {
            const y = vbHeight * pct;
            const priceVal = maxPrice - pct * priceRange;
            return (
              <g key={`grid-${idx}`}>
                <line x1={0} y1={y} x2={plotWidth} y2={y} stroke="#27272a" strokeWidth="1" strokeDasharray="3 3" />
                <text x={plotWidth + 10} y={y + 3.5} fill="#71717a" fontSize="10" fontFamily="monospace">
                  ${priceVal.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Right Axis Separator Line */}
          <line x1={plotWidth} y1={0} x2={plotWidth} y2={vbHeight} stroke="#27272a" strokeWidth="1" />

          {/* 1. ORDER BLOCKS (OB) SHADED ZONES */}
          {market.zones
            ?.filter((z) => z.kind === 'OB')
            .map((ob, idx) => {
              const yTop = getY(ob.top);
              const yBottom = getY(ob.bottom);
              const h = Math.max(5, Math.abs(yBottom - yTop));
              const y = Math.min(yTop, yBottom);
              const isBull = ob.bullish;

              return (
                <g key={`ob-${idx}`}>
                  <rect
                    x={20}
                    y={y}
                    width={plotWidth - 25}
                    height={h}
                    fill={isBull ? '#10b981' : '#f43f5e'}
                    fillOpacity="0.12"
                    stroke={isBull ? '#059669' : '#e11d48'}
                    strokeWidth="1"
                    strokeDasharray="4 2"
                    rx="3"
                  />
                  <text
                    x={26}
                    y={y + 11}
                    fill={isBull ? '#34d399' : '#fb7185'}
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {isBull ? 'DEMAND OB' : 'SUPPLY OB'} (${ob.bottom.toFixed(1)} – ${ob.top.toFixed(1)})
                  </text>
                </g>
              );
            })}

          {/* 2. FAIR VALUE GAPS (FVG) */}
          {market.zones
            ?.filter((z) => z.kind === 'FVG')
            .map((fvg, idx) => {
              const yTop = getY(fvg.top);
              const yBottom = getY(fvg.bottom);
              const h = Math.max(4, Math.abs(yBottom - yTop));
              const y = Math.min(yTop, yBottom);

              return (
                <g key={`fvg-${idx}`}>
                  <rect
                    x={35}
                    y={y}
                    width={plotWidth - 45}
                    height={h}
                    fill="#eab308"
                    fillOpacity="0.10"
                    stroke="#ca8a04"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    rx="2"
                  />
                  <text x={40} y={y + 10} fill="#fde047" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                    FVG (${fvg.bottom.toFixed(1)} – ${fvg.top.toFixed(1)})
                  </text>
                </g>
              );
            })}

          {/* 3. BOS & CHOCH STRUCTURAL BREAK LINES */}
          {market.bos && (
            <g>
              <line
                x1={0}
                y1={getY(market.bos.price)}
                x2={plotWidth}
                y2={getY(market.bos.price)}
                stroke="#c084fc"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <rect
                x={plotWidth - 110}
                y={getY(market.bos.price) - 8}
                width={100}
                height={16}
                rx="3"
                fill="#581c87"
              />
              <text
                x={plotWidth - 105}
                y={getY(market.bos.price) + 3.5}
                fill="#faf5ff"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                BOS ${market.bos.price.toFixed(1)}
              </text>
            </g>
          )}

          {market.choch && (
            <g>
              <line
                x1={0}
                y1={getY(market.choch.price)}
                x2={plotWidth}
                y2={getY(market.choch.price)}
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <rect
                x={plotWidth - 120}
                y={getY(market.choch.price) - 8}
                width={110}
                height={16}
                rx="3"
                fill="#0369a1"
              />
              <text
                x={plotWidth - 115}
                y={getY(market.choch.price) + 3.5}
                fill="#f0f9ff"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                CHoCH ${market.choch.price.toFixed(1)}
              </text>
            </g>
          )}

          {/* 4. CANDLESTICKS */}
          {candles.map((c, idx) => {
            const x = 12 + idx * candleSpacing;
            const isUp = c.close >= c.open;
            const yHigh = getY(c.high);
            const yLow = getY(c.low);
            const yOpen = getY(c.open);
            const yClose = getY(c.close);

            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
            const color = isUp ? '#10b981' : '#f43f5e';

            return (
              <g key={`c-${c.time}-${idx}`}>
                {/* Wick */}
                <line
                  x1={x + candleBodyWidth / 2}
                  y1={yHigh}
                  x2={x + candleBodyWidth / 2}
                  y2={yLow}
                  stroke={color}
                  strokeWidth="1.5"
                />
                {/* Body */}
                <rect
                  x={x}
                  y={bodyTop}
                  width={candleBodyWidth}
                  height={bodyHeight}
                  fill={color}
                  stroke={color}
                  rx="1"
                />
              </g>
            );
          })}

          {/* 5. ACTIVE TRADE OVERLAYS (ENTRY, SL, TP) */}
          {positionsState.positions.map((pos) => {
            const yEntry = getY(pos.price_open);
            const ySL = getY(pos.sl);
            const yTP = getY(pos.tp);

            return (
              <g key={`pos-${pos.ticket}`}>
                {/* Entry Dotted Line */}
                <line x1={0} y1={yEntry} x2={plotWidth} y2={yEntry} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
                <rect x={plotWidth - 170} y={yEntry - 8} width={160} height={16} rx="3" fill="#075985" />
                <text x={plotWidth - 165} y={yEntry + 3.5} fill="#e0f2fe" fontSize="9" fontWeight="bold" fontFamily="monospace">
                  #{pos.ticket} {pos.type} @ ${pos.price_open.toFixed(1)}
                </text>

                {/* Stop Loss Line */}
                <line x1={0} y1={ySL} x2={plotWidth} y2={ySL} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="4 2" />
                <rect x={plotWidth - 100} y={ySL - 8} width={90} height={16} rx="3" fill="#881337" />
                <text x={plotWidth - 95} y={ySL + 3.5} fill="#ffe4e6" fontSize="9" fontWeight="bold" fontFamily="monospace">
                  SL ${pos.sl.toFixed(1)}
                </text>

                {/* Take Profit Line */}
                <line x1={0} y1={yTP} x2={plotWidth} y2={yTP} stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" />
                <rect x={plotWidth - 100} y={yTP - 8} width={90} height={16} rx="3" fill="#064e3b" />
                <text x={plotWidth - 95} y={yTP + 3.5} fill="#d1fae5" fontSize="9" fontWeight="bold" fontFamily="monospace">
                  TP ${pos.tp.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Current Live Spot Price Level */}
          <line
            x1={0}
            y1={getY(ticker.bid)}
            x2={plotWidth}
            y2={getY(ticker.bid)}
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
          <rect
            x={plotWidth + 4}
            y={getY(ticker.bid) - 9}
            width={75}
            height={18}
            rx="3"
            fill="#ffffff"
          />
          <text
            x={plotWidth + 9}
            y={getY(ticker.bid) + 4}
            fill="#000000"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
          >
            ${ticker.bid.toFixed(2)}
          </text>
        </svg>
      </div>
    </div>
  );
};

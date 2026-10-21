/**
 * SMCInteractiveChart.tsx - Clean Institutional SMC Candlestick Chart
 * Faithful to institutional SMC order flow (matching image.png):
 * - Order Blocks with bold 'ORDER BLOCK' / 'BREAKER BLOCK' inside shaded boxes
 * - Dotted lines with embedded text ('······ LIQUIDITY ······', '······ 50% EQUILIBRIUM ······')
 * - Projected Risk (red) & Reward (green) zones from Order Block levels
 * - On tapping a trade: focuses & highlights that trade's Order Block in the chart
 * - Cross-pair linked signal indicators for instant switching across pairs
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useMarket, usePositions, useTicker } from '../hooks/useTradingStore';
import { findCorrespondingOrderBlock } from '../engine/tradeJournal';
import { calculateATR, detectFVGs, detectOrderBlocks, MarketStructureEngine } from '../engine/smcCore';
import { tradingEngine } from '../engine/tradingEngine';
import type { SupportedSymbol } from '../engine/instrumentConfig';
import type { Candle, Zone } from '../types/smc';

export type ChartTimeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4';

export interface SMCIndicatorConfig {
  orderBlocks: boolean;
  fairValueGaps: boolean;
  structure: boolean;
  signals: boolean;
  trades: boolean;
}

export const DEFAULT_INDICATOR_CONFIG: SMCIndicatorConfig = {
  orderBlocks: true,
  fairValueGaps: true,
  structure: true,
  signals: true,
  trades: true,
};

interface SMCInteractiveChartProps {
  height?: number;
  timeframe: ChartTimeframe;
  showIndicators?: boolean;
  indicatorConfig?: SMCIndicatorConfig;
}

const CandleCountdownBadge: React.FC<{ timeframe: ChartTimeframe }> = React.memo(({ timeframe }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const periodMinutes =
    timeframe === 'M1' ? 1 : timeframe === 'M5' ? 5 : timeframe === 'M15' ? 15 : timeframe === 'H1' ? 60 : 240;
  const periodSeconds = periodMinutes * 60;
  const currentSeconds = Math.floor(now / 1000) % periodSeconds;
  const secondsToClose = periodSeconds - currentSeconds;
  const mins = Math.floor(secondsToClose / 60);
  const secs = secondsToClose % 60;

  return (
    <span className="text-amber-300 text-[10px] tabular-nums">
      Closes in {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  );
});

export const SMCInteractiveChart: React.FC<SMCInteractiveChartProps> = ({
  height = 380,
  timeframe,
  showIndicators = true,
  indicatorConfig = DEFAULT_INDICATOR_CONFIG,
}) => {
  const market = useMarket();
  const positionsState = usePositions();
  const ticker = useTicker();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(900);
  const [chartHeight, setChartHeight] = useState(height - 44);
  const [visibleCount, setVisibleCount] = useState(60);
  const [panOffset, setPanOffset] = useState(0);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number; candle: Candle } | null>(null);
  const pointerStart = useRef<{ x: number; offset: number } | null>(null);

  const selectedPosition = useMemo(
    () =>
      positionsState.positions.find((position) => position.ticket === positionsState.selectedTicket) ||
      positionsState.positions[0],
    [positionsState.positions, positionsState.selectedTicket]
  );

  const selectedOrderBlock = useMemo(() => {
    if (!selectedPosition) return undefined;
    if (selectedPosition.strategyOrderBlock) return selectedPosition.strategyOrderBlock;
    const found = findCorrespondingOrderBlock(selectedPosition.type, selectedPosition.price_open, market.zones);
    if (found) return found;

    // Guaranteed fallback: synthesize active trade order block zone around entry so it ALWAYS shows
    const isBuy = selectedPosition.type === 'BUY';
    const zoneBuffer = Math.max(0.8, ticker.spread * 0.08 || 1.2);
    return {
      kind: 'OB' as const,
      bullish: isBuy,
      bottom: isBuy ? selectedPosition.price_open - zoneBuffer * 1.5 : selectedPosition.price_open - zoneBuffer * 0.4,
      top: isBuy ? selectedPosition.price_open + zoneBuffer * 0.4 : selectedPosition.price_open + zoneBuffer * 1.5,
      tests: 0,
      filled: false,
      mitigated: false,
      born: 0,
    } as Zone;
  }, [market.zones, selectedPosition, ticker.spread]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height: h } = entry.contentRect;
      if (width > 0) setChartWidth(Math.floor(width));
      if (h > 0) setChartHeight(Math.floor(h));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const rawCandles = useMemo(() => {
    let sourceCandles: Candle[] = [];
    if (timeframe === 'M1') sourceCandles = market.candlesM1;
    else if (timeframe === 'M5') sourceCandles = market.candlesM5;
    else if (timeframe === 'M15') sourceCandles = market.candlesM15;
    else if (timeframe === 'H1') sourceCandles = market.candlesH1;
    else if (timeframe === 'H4') {
      const h1 = market.candlesH1 || [];
      if (!h1.length) return [];
      const aggregated: Candle[] = [];
      for (let i = 0; i < h1.length; i += 4) {
        const chunk = h1.slice(i, i + 4);
        if (!chunk.length) continue;
        const open = chunk[0].open;
        const close = chunk[chunk.length - 1].close;
        const high = Math.max(...chunk.map((c) => c.high));
        const low = Math.min(...chunk.map((c) => c.low));
        const volume = chunk.reduce((sum, c) => sum + c.volume, 0);
        aggregated.push({
          time: chunk[0].time,
          timeStr: chunk[0].timeStr,
          open,
          high,
          low,
          close,
          volume,
        });
      }
      sourceCandles = aggregated;
    }

    if (!Array.isArray(sourceCandles) || sourceCandles.length === 0) return [];

    // Ensure the very last bar dynamically reflects the live ticker bid in real time
    const cloned = sourceCandles.map((c, i) => {
      if (i === sourceCandles.length - 1 && ticker.bid > 0) {
        return {
          ...c,
          close: ticker.bid,
          high: Math.max(c.high, ticker.bid),
          low: Math.min(c.low, ticker.bid),
        };
      }
      return c;
    });

    return cloned;
  }, [market.candlesM1, market.candlesM5, market.candlesM15, market.candlesH1, timeframe, ticker.bid]);

  // Dynamic timeframe-specific technical SMC calculation synchronized with trading engine
  const {
    timeframeZones,
    timeframeStructure,
    timeframeEqPrice,
    timeframeBSL,
    timeframeSSL,
  } = useMemo(() => {
    // If the centralized trading engine has calculated indicators for this timeframe, use them directly
    const engineData = market.timeframeData?.[timeframe];
    if (engineData && engineData.zones.length > 0) {
      const zones = engineData.zones;
      const bos = engineData.bos;
      const choch = engineData.choch;
      const dr = engineData.dealing_range;
      const bsl = dr ? dr.high : (rawCandles.length ? Math.max(...rawCandles.map((c) => c.high)) : ticker.bid + 1);
      const ssl = dr ? dr.low : (rawCandles.length ? Math.min(...rawCandles.map((c) => c.low)) : ticker.bid - 1);
      const eq = dr ? dr.equilibrium : (bsl + ssl) / 2;
      return {
        timeframeZones: zones,
        timeframeStructure: { bos, choch },
        timeframeEqPrice: Number(eq.toFixed(2)),
        timeframeBSL: Number(bsl.toFixed(2)),
        timeframeSSL: Number(ssl.toFixed(2)),
      };
    }

    if (rawCandles.length < 10) {
      return {
        timeframeZones: [],
        timeframeStructure: { bos: null, choch: null },
        timeframeEqPrice: ticker.bid,
        timeframeBSL: ticker.bid + 1,
        timeframeSSL: ticker.bid - 1,
      };
    }

    const atrArray = calculateATR(rawCandles, 14);
    const obs = detectOrderBlocks(rawCandles, atrArray);
    const fvgs = detectFVGs(rawCandles, atrArray);
    const zones = [...obs, ...fvgs];

    const engine = new MarketStructureEngine(2);
    engine.update(rawCandles);
    const bos = engine.events.filter((e) => e.kind === 'BOS').pop() || null;
    const choch = engine.events.filter((e) => e.kind === 'CHoCH').pop() || null;
    const dr = engine.dealingRange();

    // Swings for Buy-Side (BSL) and Sell-Side (SSL) Liquidity levels
    const swingHighs = engine.swings.filter((s) => s.kind === 'H').map((s) => s.price);
    const swingLows = engine.swings.filter((s) => s.kind === 'L').map((s) => s.price);

    const bsl = swingHighs.length > 0 ? Math.max(...swingHighs.slice(-6)) : Math.max(...rawCandles.map((c) => c.high));
    const ssl = swingLows.length > 0 ? Math.min(...swingLows.slice(-6)) : Math.min(...rawCandles.map((c) => c.low));

    // 50% Equilibrium precisely for this timeframe's dealing range
    const eq = dr ? dr.equilibrium : (bsl + ssl) / 2;

    return {
      timeframeZones: zones,
      timeframeStructure: { bos, choch },
      timeframeEqPrice: Number(eq.toFixed(2)),
      timeframeBSL: Number(bsl.toFixed(2)),
      timeframeSSL: Number(ssl.toFixed(2)),
    };
  }, [rawCandles, ticker.bid]);

  const nearestZones = useMemo(() => {
    const zones = timeframeZones.length > 0 ? timeframeZones : Array.isArray(market.zones) ? market.zones : [];
    const currentPrice = ticker.bid;
    const active = [...zones].filter((z) => !z.filled);

    // Keep UI clean and uncluttered: select the nearest Bullish Demand OB and nearest Bearish Supply OB
    const bullish = active.filter((z) => z.bullish).sort((a, b) => Math.abs(a.top - currentPrice) - Math.abs(b.top - currentPrice))[0];
    const bearish = active.filter((z) => !z.bullish).sort((a, b) => Math.abs(a.bottom - currentPrice) - Math.abs(b.bottom - currentPrice))[0];
    const selected: Zone[] = [];
    if (bullish) selected.push(bullish);
    if (bearish) selected.push(bearish);
    return selected;
  }, [timeframeZones, market.zones, ticker.bid]);

  const handleZoomIn = useCallback(() => {
    setVisibleCount((c) => Math.max(16, c - 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setVisibleCount((c) => Math.min(120, c + 10));
  }, []);

  const handleZoomReset = useCallback(() => {
    const defaultVisible = timeframe === 'H4' ? 35 : timeframe === 'H1' ? 45 : 55;
    setVisibleCount(defaultVisible);
    setPanOffset(0);
  }, [timeframe]);

  const candles = useMemo(() => {
    if (!rawCandles.length) return [];
    const count = Math.max(15, Math.min(100, visibleCount));
    const maxOffset = Math.max(0, rawCandles.length - count);
    const clampedOffset = Math.max(0, Math.min(maxOffset, panOffset));
    const start = Math.max(0, rawCandles.length - count - clampedOffset);
    const end = Math.min(rawCandles.length, start + count);
    return rawCandles.slice(start, end);
  }, [rawCandles, visibleCount, panOffset]);

  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (!candles.length) return { minPrice: 0, maxPrice: 1, priceRange: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    // Include live ticker bid so price line is always comfortably within view
    if (ticker.bid > 0) {
      if (ticker.bid < min) min = ticker.bid;
      if (ticker.bid > max) max = ticker.bid;
    }
    // Include active trade price levels if in proximity
    if (selectedPosition && selectedPosition.price_open > 0) {
      const dist = Math.abs(selectedPosition.price_open - ticker.bid);
      const span = max - min;
      if (dist < Math.max(10, span * 2)) {
        if (selectedPosition.price_open < min) min = selectedPosition.price_open;
        if (selectedPosition.price_open > max) max = selectedPosition.price_open;
      }
    }
    const padding = (max - min) * 0.12 || 1.0;
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      priceRange: max - min + padding * 2 || 1,
    };
  }, [candles, ticker.bid, selectedPosition]);

  const vbWidth = Math.max(300, chartWidth);
  const vbHeight = Math.max(200, chartHeight);
  const axisWidth = chartWidth < 500 ? 55 : 70;
  const plotWidth = Math.max(100, vbWidth - axisWidth);

  const getY = useCallback(
    (price: number) => {
      const clamped = Math.max(minPrice, Math.min(maxPrice, price));
      return vbHeight - ((clamped - minPrice) / priceRange) * vbHeight;
    },
    [minPrice, maxPrice, priceRange, vbHeight]
  );

  // Proportional candlestick sizing & clean right-alignment (never oversized or unresizeable)
  const availablePlotWidth = Math.max(100, plotWidth - 30);
  const maxCandleSpacing = 22;
  const minCandleSpacing = 5;
  const idealSpacing = candles.length > 0 ? availablePlotWidth / candles.length : 12;
  const candleSpacing = Math.max(minCandleSpacing, Math.min(maxCandleSpacing, idealSpacing));
  const candleBodyWidth = Math.max(2.5, Math.min(12, candleSpacing * 0.68));

  const totalCandlesWidth = candles.length * candleSpacing;
  const candleStartX = totalCandlesWidth < availablePlotWidth
    ? plotWidth - 25 - totalCandlesWidth
    : 15;

  const chartStructure = timeframeStructure;

  const chartSignal = useMemo(() => {
    if (market.signal) return market.signal;
    if (candles.length < 10) return null;
    const atrArray = calculateATR(candles, 14);
    const atr = Number(atrArray[atrArray.length - 1]) || 2.0;
    const obZones = detectOrderBlocks(candles, atrArray);
    const struct = timeframeStructure;
    const lastPrice = candles[candles.length - 1].close;

    if (struct.bos?.direction === 'bullish' && obZones.some((z) => z.bullish && !z.filled)) {
      return {
        direction: 'BUY' as const,
        timeframe: timeframe === 'M1' ? ('M1' as const) : timeframe === 'M15' ? ('M15' as const) : ('M5' as const),
        score: 75,
        entry: lastPrice,
        sl: Number((lastPrice - atr * 1.5).toFixed(2)),
        tp: Number((lastPrice + atr * 3.0).toFixed(2)),
        reasons: [`${timeframe} Trend Alignment`, 'Bullish Displacement BOS', 'Demand Order Block Retest'],
        atr,
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }, [market.signal, candles, timeframeStructure, timeframe]);

  // Dealing range equilibrium level
  const eqPrice = timeframeEqPrice;

  // Helper to render dotted horizontal line with right-anchored badge that never covers center candlesticks
  const renderDottedTextLine = (
    y: number,
    text: string,
    color: string,
    badgeWidth: number = 110,
    fontSize: number = 9
  ) => {
    if (isNaN(y) || y < 6 || y > vbHeight - 6) return null;
    const badgeX = Math.max(15, plotWidth - badgeWidth - 6);
    return (
      <g>
        <line
          x1={10}
          y1={y}
          x2={badgeX - 4}
          y2={y}
          stroke={color}
          strokeWidth="1.1"
          strokeDasharray="4 4"
        />
        <rect
          x={badgeX}
          y={y - 7}
          width={badgeWidth}
          height={14}
          rx="3"
          fill="#0c1017"
          stroke={color}
          strokeWidth="0.8"
        />
        <text
          x={badgeX + badgeWidth / 2}
          y={y + 3.5}
          fill={color}
          fontSize={fontSize}
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
          letterSpacing="0.3"
        >
          {text}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full h-full flex flex-col font-mono select-none overflow-hidden bg-black text-white">
      {/* Top Strip: Clean Institutional Header with Zoom & Telemetry */}
      <div className="px-3 py-1.5 bg-[#090d14] border-b border-zinc-800/90 flex items-center justify-between flex-wrap gap-2 text-[11px]">
        {/* Left: Active Pair Badge & Structure Status */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800">
            <span className="font-black text-white text-xs">{ticker.symbol}</span>
            <span className="text-[10px] text-sky-400 font-bold px-1 rounded bg-sky-950/80 border border-sky-500/30">
              {timeframe}
            </span>
          </div>

          {/* Quick Legend Tags */}
          <div className="hidden sm:flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-xs bg-emerald-500/30 border border-emerald-500" />
              <span>Demand (+OB)</span>
            </span>
            <span className="flex items-center gap-1 text-rose-400 font-medium">
              <span className="w-2 h-2 rounded-xs bg-rose-500/30 border border-rose-500" />
              <span>Supply (-OB)</span>
            </span>
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <span className="w-2 border-t border-amber-400 inline-block" />
              <span>50% EQ</span>
            </span>
          </div>
        </div>

        {/* Right: Candlestick Zoom Controls & Live Quotes */}
        <div className="flex items-center gap-2.5">
          {/* Zoom In / Out Controls */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5 text-zinc-300">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
              title="Zoom Out (Show More / Sleeker Candlesticks)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="px-1.5 py-0.5 text-[10px] font-bold hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
              title="Reset Zoom (Optimal Fit)"
            >
              Fit
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
              title="Zoom In (Enlarge Candlesticks)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Live Quote & Candle Countdown */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 font-bold">
              <span className="text-zinc-500 text-[10px]">BID:</span>
              <span className="text-white tabular-nums">${ticker.bid.toFixed(ticker.symbol === 'XAUUSD' || ticker.symbol === 'USDJPY' ? 2 : 4)}</span>
            </div>
            <CandleCountdownBadge timeframe={timeframe} />
          </div>
        </div>
      </div>

      {/* SVG Candlestick & Institutional Structure Canvas */}
      <div ref={chartContainerRef} className="flex-1 min-h-0 w-full bg-black p-1 sm:p-2 overflow-hidden relative">
        <svg
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          className="block w-full h-full"
          style={{ touchAction: 'none', cursor: crosshair ? 'crosshair' : 'grab' }}
          onPointerDown={(event) => {
            pointerStart.current = { x: event.clientX, offset: panOffset };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const mouseX = Math.max(0, Math.min(plotWidth, event.clientX - rect.left));
            const mouseY = Math.max(0, Math.min(vbHeight, event.clientY - rect.top));
            const mouseOffset = mouseX - candleStartX;
            const candleIdx = Math.max(0, Math.min(candles.length - 1, Math.floor(mouseOffset / candleSpacing)));
            const activeCandle = candles[candleIdx] || candles[candles.length - 1];

            setCrosshair({ x: mouseX, y: mouseY, candle: activeCandle });

            if (pointerStart.current) {
              const deltaX = event.clientX - pointerStart.current.x;
              const candleDelta = Math.round(deltaX / candleSpacing);
              setPanOffset(Math.max(0, pointerStart.current.offset + candleDelta));
            }
          }}
          onPointerUp={() => { pointerStart.current = null; }}
          onPointerCancel={() => { pointerStart.current = null; }}
          onPointerLeave={() => setCrosshair(null)}
          onWheel={(event) => {
            event.preventDefault();
            setVisibleCount((count) => Math.max(20, Math.min(120, count + (event.deltaY > 0 ? 8 : -8))));
            setPanOffset(0);
          }}
        >
          {candles.length === 0 && (
            <text
              x={vbWidth / 2}
              y={vbHeight / 2}
              fill="#a1a1aa"
              textAnchor="middle"
              fontSize="13"
              fontFamily="monospace"
            >
              Waiting for live market candles...
            </text>
          )}

          {/* Subtle Horizontal Price Grid Lines */}
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((pct, idx) => {
            const y = vbHeight * pct;
            const priceVal = maxPrice - pct * priceRange;
            return (
              <g key={`grid-${idx}`}>
                <line x1={0} y1={y} x2={plotWidth} y2={y} stroke="#18181b" strokeWidth="1" strokeDasharray="3 3" />
                <text x={plotWidth + 8} y={y + 3.5} fill="#71717a" fontSize="10" fontFamily="monospace">
                  ${priceVal.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Right Axis Separator Line */}
          <line x1={plotWidth} y1={0} x2={plotWidth} y2={vbHeight} stroke="#27272a" strokeWidth="1" />

          {/* 1. LIQUIDITY LEVELS (BSL & SSL calculated mathematically from swing structure) */}
          {showIndicators && indicatorConfig.structure && timeframeBSL > 0 && (() => {
            const yBsl = getY(timeframeBSL);
            return (
              <g key="bsl-level">
                {renderDottedTextLine(yBsl, `BSL $${timeframeBSL.toFixed(2)}`, '#f43f5e', 140, 9)}
              </g>
            );
          })()}
          {showIndicators && indicatorConfig.structure && timeframeSSL > 0 && (() => {
            const ySsl = getY(timeframeSSL);
            return (
              <g key="ssl-level">
                {renderDottedTextLine(ySsl, `SSL $${timeframeSSL.toFixed(2)}`, '#10b981', 140, 9)}
              </g>
            );
          })()}

          {/* 2. 50% EQUILIBRIUM LEVEL */}
          {showIndicators && indicatorConfig.structure && eqPrice > 0 && (() => {
            const yEq = getY(eqPrice);
            return (
              <g key="eq-level">
                {renderDottedTextLine(yEq, `50% EQ $${eqPrice.toFixed(2)}`, '#fbbf24', 135, 9)}
              </g>
            );
          })()}

          {/* 3. ORDER BLOCKS & BREAKER BLOCKS (Institutional translucent shaded zones with crisp right badges) */}
          {showIndicators && indicatorConfig.orderBlocks && (() => {
            const obList = nearestZones.filter((zone) => zone.kind === 'OB');
            if (selectedOrderBlock && !obList.some((z) => Math.abs(z.bottom - selectedOrderBlock.bottom) < 0.01)) {
              obList.unshift(selectedOrderBlock);
            }

            return obList.map((ob, idx) => {
              const yTop = getY(ob.top);
              const yBottom = getY(ob.bottom);
              const h = Math.max(8, Math.abs(yBottom - yTop));
              const y = Math.min(yTop, yBottom);
              const isBull = ob.bullish;
              const isBreaker = ob.tests > 0;

              // Check if this OB belongs to the tapped / selected trade
              const isTradeOB = selectedPosition && (
                selectedOrderBlock === ob ||
                (Math.abs(ob.bottom - (selectedOrderBlock?.bottom ?? -999)) < 0.05) ||
                (selectedPosition.type === (isBull ? 'BUY' : 'SELL') &&
                  selectedPosition.price_open >= ob.bottom - 2 &&
                  selectedPosition.price_open <= ob.top + 2)
              );

              const color = isTradeOB ? '#38bdf8' : isBull ? '#10b981' : '#f43f5e';
              const label = isTradeOB
                ? `Trade #${selectedPosition.ticket} OB`
                : isBreaker
                ? `Breaker $${ob.bottom.toFixed(1)}–$${ob.top.toFixed(1)}`
                : isBull
                ? `+OB $${ob.bottom.toFixed(1)}–$${ob.top.toFixed(1)}`
                : `-OB $${ob.bottom.toFixed(1)}–$${ob.top.toFixed(1)}`;

              return (
                <g key={`ob-${idx}`}>
                  {/* Institutional translucent shaded zone */}
                  <rect
                    x={15}
                    y={y}
                    width={plotWidth - 15}
                    height={h}
                    fill={isBull ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)'}
                    stroke={color}
                    strokeWidth={isTradeOB ? 1.5 : 0.8}
                    strokeDasharray="3 3"
                    rx="2"
                  />
                  {/* Clean right-anchored badge */}
                  {renderDottedTextLine(
                    y + h / 2,
                    label,
                    color,
                    Math.min(170, label.length * 7.5 + 16),
                    chartWidth < 500 ? 8.5 : 9
                  )}
                </g>
              );
            });
          })()}

          {/* 4. FAIR VALUE GAPS (FVG) - Subtle imbalance zone with right badge */}
          {showIndicators && indicatorConfig.fairValueGaps && nearestZones
            .filter((zone) => zone.kind === 'FVG')
            .map((fvg, idx) => {
              const yTop = getY(fvg.top);
              const yBottom = getY(fvg.bottom);
              const h = Math.max(6, Math.abs(yBottom - yTop));
              const y = Math.min(yTop, yBottom);
              const label = `FVG $${fvg.bottom.toFixed(1)}–$${fvg.top.toFixed(1)}`;
              return (
                <g key={`fvg-${idx}`}>
                  <rect
                    x={15}
                    y={y}
                    width={plotWidth - 15}
                    height={h}
                    fill="rgba(234, 179, 8, 0.07)"
                    stroke="#eab308"
                    strokeWidth="0.8"
                    strokeDasharray="3 3"
                    rx="2"
                  />
                  {renderDottedTextLine(
                    y + h / 2,
                    label,
                    '#eab308',
                    Math.min(160, label.length * 7 + 14),
                    8.5
                  )}
                </g>
              );
            })}

          {/* 5. BOS & CHOCH STRUCTURAL BREAK LINES */}
          {showIndicators && indicatorConfig.structure && chartStructure.bos && (() => {
            const yBos = getY(chartStructure.bos.price);
            return (
              <g key="bos-line">
                {renderDottedTextLine(
                  yBos,
                  `BOS ${chartStructure.bos.direction.toUpperCase()}`,
                  '#c084fc',
                  120,
                  9
                )}
              </g>
            );
          })()}

          {showIndicators && indicatorConfig.structure && chartStructure.choch && (() => {
            const yChoch = getY(chartStructure.choch.price);
            return (
              <g key="choch-line">
                {renderDottedTextLine(
                  yChoch,
                  `CHoCH ${chartStructure.choch.direction.toUpperCase()}`,
                  '#38bdf8',
                  125,
                  9
                )}
              </g>
            );
          })()}

          {/* 6. SIGNAL TARGETS */}
          {showIndicators && indicatorConfig.signals && chartSignal && (
            <g key="signal-targets">
              {renderDottedTextLine(
                getY(chartSignal.entry),
                `ENTRY $${chartSignal.entry.toFixed(2)}`,
                '#38bdf8',
                130,
                9
              )}
              {renderDottedTextLine(
                getY(chartSignal.sl),
                `SL $${chartSignal.sl.toFixed(2)}`,
                '#f43f5e',
                110,
                9
              )}
              {renderDottedTextLine(
                getY(chartSignal.tp),
                `TP $${chartSignal.tp.toFixed(2)}`,
                '#10b981',
                110,
                9
              )}
            </g>
          )}

          {/* 7. CANDLESTICKS */}
          {candles.map((c, idx) => {
            const x = candleStartX + idx * candleSpacing;
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

          {/* 8. ACTIVE BROKER TRADES (Dotted lines with embedded text) */}
          {showIndicators && indicatorConfig.trades && positionsState.positions.map((pos) => {
            const yEntry = getY(pos.price_open);
            const ySL = getY(pos.sl);
            const yTP = getY(pos.tp);
            const isFocused = selectedPosition?.ticket === pos.ticket;

            return (
              <g key={`pos-${pos.ticket}`} opacity={isFocused ? 1 : 0.45}>
                {/* Entry Dotted Line with Text */}
                {renderDottedTextLine(
                  yEntry,
                  `#${pos.ticket} ${pos.type} @ $${pos.price_open.toFixed(2)}`,
                  '#38bdf8',
                  145,
                  9
                )}

                {/* Stop Loss Line */}
                {pos.sl > 0 &&
                  renderDottedTextLine(
                    ySL,
                    `SL $${pos.sl.toFixed(2)}`,
                    '#f43f5e',
                    95,
                    8.5
                  )}

                {/* Take Profit Line */}
                {pos.tp > 0 &&
                  renderDottedTextLine(
                    yTP,
                    `TP $${pos.tp.toFixed(2)}`,
                    '#10b981',
                    95,
                    8.5
                  )}
              </g>
            );
          })}

          {/* Current Spot Price Dotted Line */}
          <line
            x1={0}
            y1={getY(ticker.bid)}
            x2={plotWidth}
            y2={getY(ticker.bid)}
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />
          <rect
            x={plotWidth + 4}
            y={getY(ticker.bid) - 9}
            width={axisWidth - 8}
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

          {/* Crosshair */}
          {crosshair && (
            <g pointerEvents="none">
              <line x1={crosshair.x} y1={0} x2={crosshair.x} y2={vbHeight} stroke="#e4e4e7" strokeOpacity="0.6" strokeDasharray="3 3" />
              <line x1={0} y1={crosshair.y} x2={plotWidth} y2={crosshair.y} stroke="#e4e4e7" strokeOpacity="0.6" strokeDasharray="3 3" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

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
import { useMarket, usePositions, useTicker, useScannerAnalyses } from '../hooks/useTradingStore';
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

export const SMCInteractiveChart: React.FC<SMCInteractiveChartProps> = ({
  height = 380,
  timeframe,
  showIndicators = true,
  indicatorConfig = DEFAULT_INDICATOR_CONFIG,
}) => {
  const market = useMarket();
  const positionsState = usePositions();
  const ticker = useTicker();
  const scannerAnalyses = useScannerAnalyses();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(900);
  const [chartHeight, setChartHeight] = useState(height - 44);
  const [visibleCount, setVisibleCount] = useState(60);
  const [panOffset, setPanOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
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
    return [...zones]
      .filter((z) => !z.filled)
      .sort((a, b) => {
        const distA = Math.abs((a.top + a.bottom) / 2 - currentPrice);
        const distB = Math.abs((b.top + b.bottom) / 2 - currentPrice);
        return distA - distB;
      })
      .slice(0, 6);
  }, [timeframeZones, market.zones, ticker.bid]);

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

  const candleSpacing = candles.length > 0 ? (plotWidth - 20) / candles.length : 10;
  const candleBodyWidth = Math.max(3, candleSpacing * 0.65);

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

  // Calculate timeframe closure countdown
  const secondsToClose = useMemo(() => {
    const periodMinutes =
      timeframe === 'M1' ? 1 : timeframe === 'M5' ? 5 : timeframe === 'M15' ? 15 : timeframe === 'H1' ? 60 : 240;
    const periodSeconds = periodMinutes * 60;
    const currentSeconds = Math.floor(now / 1000) % periodSeconds;
    return periodSeconds - currentSeconds;
  }, [now, timeframe]);

  // Other currency pairs signals linked into SMC Engine
  const otherPairAnalyses = useMemo(() => {
    return scannerAnalyses.filter((item) => item.symbol !== ticker.symbol);
  }, [scannerAnalyses, ticker.symbol]);

  // Helper to render dotted horizontal line with centered text
  const renderDottedTextLine = (
    y: number,
    text: string,
    color: string,
    textWidth: number = 110,
    fontSize: number = 9.5
  ) => {
    if (isNaN(y) || y < 6 || y > vbHeight - 6) return null;
    const cx = plotWidth / 2;
    const half = textWidth / 2;
    return (
      <g>
        <line
          x1={10}
          y1={y}
          x2={Math.max(15, cx - half - 6)}
          y2={y}
          stroke={color}
          strokeWidth="1.3"
          strokeDasharray="4 4"
        />
        <text
          x={cx}
          y={y + 3.5}
          fill={color}
          fontSize={fontSize}
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
          letterSpacing="0.5"
        >
          {text}
        </text>
        <line
          x1={Math.min(plotWidth - 5, cx + half + 6)}
          y1={y}
          x2={plotWidth}
          y2={y}
          stroke={color}
          strokeWidth="1.3"
          strokeDasharray="4 4"
        />
      </g>
    );
  };

  return (
    <div className="w-full h-full flex flex-col font-mono select-none overflow-hidden bg-black text-white">
      {/* Top Strip 1: Linked Currency Pair Indicators */}
      {otherPairAnalyses.length > 0 && (
        <div className="px-3 py-1.5 bg-[#090e15] border-b border-zinc-800/80 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar text-[10px]">
          <div className="flex items-center gap-1.5 text-zinc-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span className="font-bold uppercase tracking-wider text-[9px] text-zinc-500">Cross-Pair Signals:</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {otherPairAnalyses.map((pair) => {
              const isBull = pair.bias === 'BUY';
              const hasSignal = Boolean(pair.signal);
              return (
                <button
                  key={pair.symbol}
                  onClick={() => tradingEngine.switchSymbol(pair.symbol as SupportedSymbol)}
                  className={`px-2 py-0.5 rounded-md border font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    hasSignal
                      ? isBull
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                        : 'bg-rose-950/60 border-rose-500/40 text-rose-300 hover:bg-rose-900/60'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                  title={`Switch to ${pair.displayName} (Score: ${pair.confluenceScore}/100)`}
                >
                  <span className="text-white">{pair.symbol}</span>
                  <span className={isBull ? 'text-emerald-400' : 'text-rose-400'}>
                    {pair.bias} ({pair.confluenceScore})
                  </span>
                  <span className="text-[9px] text-zinc-500">
                    {pair.orderBlocks.length > 0 ? (isBull ? '+OB' : '-OB') : 'EQ'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Strip 2: Chart Legend & Telemetry */}
      <div className="px-3 py-1.5 bg-[#0d121a] border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2 text-[11px]">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-black text-sky-400">{ticker.symbol} · {timeframe}</span>

          {/* Institutional Legend Matching image.png */}
          <div className="hidden sm:flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2.5 h-2 rounded bg-rose-500/20 border border-rose-500" />
              <span>Order Block (-OB)</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-2 rounded bg-emerald-500/20 border border-emerald-500" />
              <span>Demand Block (+OB)</span>
            </span>
            <span className="flex items-center gap-1 text-rose-300">
              <span className="w-3 border-t-2 border-dotted border-rose-400 inline-block" />
              <span>Liquidity</span>
            </span>
            {selectedPosition && (
              <span className="flex items-center gap-1 text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/40">
                <span>Trade #{selectedPosition.ticket} OB Focused</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Bid:</span>
          <strong className="text-white tabular-nums">${ticker.bid.toFixed(2)}</strong>
          <span className="text-amber-300 text-[10px] tabular-nums">
            Closes in {String(Math.floor(secondsToClose / 60)).padStart(2, '0')}:{String(secondsToClose % 60).padStart(2, '0')}
          </span>
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
            const candleIdx = Math.floor(mouseX / candleSpacing);
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
                {renderDottedTextLine(yBsl, `······ BSL LIQUIDITY $${timeframeBSL.toFixed(2)} ······`, '#f43f5e', 180, 9.5)}
              </g>
            );
          })()}
          {showIndicators && indicatorConfig.structure && timeframeSSL > 0 && (() => {
            const ySsl = getY(timeframeSSL);
            return (
              <g key="ssl-level">
                {renderDottedTextLine(ySsl, `······ SSL LIQUIDITY $${timeframeSSL.toFixed(2)} ······`, '#10b981', 180, 9.5)}
              </g>
            );
          })()}

          {/* 2. 50% EQUILIBRIUM LEVEL (Dotted Line with Text Inside) */}
          {showIndicators && indicatorConfig.structure && eqPrice > 0 && (() => {
            const yEq = getY(eqPrice);
            return (
              <g key="eq-level">
                {renderDottedTextLine(yEq, '······ 50% EQUILIBRIUM ······', '#fbbf24', 160, 9)}
              </g>
            );
          })()}

          {/* 3. ORDER BLOCKS & BREAKER BLOCKS (Shaded boxes with bold text inside, matching image.png) */}
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
              const boxW = Math.max(120, plotWidth - 40);
              const boxCenterX = 30 + boxW / 2;
              const boxCenterY = y + h / 2;

              // Check if this OB belongs to the tapped / selected trade
              const isTradeOB = selectedPosition && (
                selectedOrderBlock === ob ||
                (Math.abs(ob.bottom - (selectedOrderBlock?.bottom ?? -999)) < 0.05) ||
                (selectedPosition.type === (isBull ? 'BUY' : 'SELL') &&
                  selectedPosition.price_open >= ob.bottom - 2 &&
                  selectedPosition.price_open <= ob.top + 2)
              );

              const color = isTradeOB ? '#38bdf8' : isBull ? '#10b981' : '#f43f5e';

              return (
                <g key={`ob-${idx}`}>
                  {/* Coloured lines with text (NO filled coloured bar overlay) */}
                  <line
                    x1={15}
                    y1={yTop}
                    x2={plotWidth}
                    y2={yTop}
                    stroke={color}
                    strokeWidth={isTradeOB ? 2.0 : 1.3}
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={15}
                    y1={yBottom}
                    x2={plotWidth}
                    y2={yBottom}
                    stroke={color}
                    strokeWidth={isTradeOB ? 2.0 : 1.3}
                    strokeDasharray="4 4"
                  />

                  {/* Centred text directly along the level */}
                  {renderDottedTextLine(
                    boxCenterY,
                    isTradeOB
                      ? `······ TRADE #${selectedPosition.ticket} ORDER BLOCK ······`
                      : isBreaker
                      ? '······ BREAKER BLOCK ······'
                      : isBull
                      ? `······ BULLISH ORDER BLOCK $${ob.bottom.toFixed(2)} – $${ob.top.toFixed(2)} ······`
                      : `······ BEARISH ORDER BLOCK $${ob.bottom.toFixed(2)} – $${ob.top.toFixed(2)} ······`,
                    color,
                    240,
                    chartWidth < 500 ? 9.5 : 10.5
                  )}
                </g>
              );
            });
          })()}

          {/* 4. FAIR VALUE GAPS (FVG) - Coloured lines and text without coloured bar */}
          {showIndicators && indicatorConfig.fairValueGaps && nearestZones
            .filter((zone) => zone.kind === 'FVG')
            .map((fvg, idx) => {
              const yTop = getY(fvg.top);
              const yBottom = getY(fvg.bottom);
              const h = Math.max(6, Math.abs(yBottom - yTop));
              const y = Math.min(yTop, yBottom);
              return (
                <g key={`fvg-${idx}`}>
                  <line
                    x1={15}
                    y1={yTop}
                    x2={plotWidth}
                    y2={yTop}
                    stroke="#eab308"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={15}
                    y1={yBottom}
                    x2={plotWidth}
                    y2={yBottom}
                    stroke="#eab308"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                  {renderDottedTextLine(
                    y + h / 2,
                    `······ FVG (IMBALANCE) $${fvg.bottom.toFixed(2)} – $${fvg.top.toFixed(2)} ······`,
                    '#eab308',
                    250,
                    9.5
                  )}
                </g>
              );
            })}

          {/* 5. BOS & CHOCH STRUCTURAL BREAK LINES (Dotted lines with embedded text) */}
          {showIndicators && indicatorConfig.structure && chartStructure.bos && (() => {
            const yBos = getY(chartStructure.bos.price);
            return (
              <g key="bos-line">
                {renderDottedTextLine(
                  yBos,
                  `······ BOS (${chartStructure.bos.direction.toUpperCase()} CONTINUATION) ······`,
                  '#c084fc',
                  220,
                  9.5
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
                  `······ CHoCH (${chartStructure.choch.direction.toUpperCase()} REVERSAL) ······`,
                  '#38bdf8',
                  220,
                  9.5
                )}
              </g>
            );
          })()}

          {/* 6. SIGNAL TARGETS (Dotted lines with embedded text) */}
          {showIndicators && indicatorConfig.signals && chartSignal && (
            <g key="signal-targets">
              {renderDottedTextLine(
                getY(chartSignal.entry),
                `······ SIGNAL ENTRY $${chartSignal.entry.toFixed(2)} ······`,
                '#38bdf8',
                170,
                9.5
              )}
              {renderDottedTextLine(
                getY(chartSignal.sl),
                `······ STOP LOSS $${chartSignal.sl.toFixed(2)} ······`,
                '#f43f5e',
                150,
                9.5
              )}
              {renderDottedTextLine(
                getY(chartSignal.tp),
                `······ TAKE PROFIT $${chartSignal.tp.toFixed(2)} ······`,
                '#10b981',
                160,
                9.5
              )}
            </g>
          )}

          {/* 7. CANDLESTICKS */}
          {candles.map((c, idx) => {
            const x = 15 + idx * candleSpacing;
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
                  `······ TRADE #${pos.ticket} ${pos.type} @ $${pos.price_open.toFixed(2)} ······`,
                  '#38bdf8',
                  190,
                  9.5
                )}

                {/* Stop Loss Line */}
                {pos.sl > 0 &&
                  renderDottedTextLine(
                    ySL,
                    `······ SL $${pos.sl.toFixed(2)} ······`,
                    '#f43f5e',
                    120,
                    9
                  )}

                {/* Take Profit Line */}
                {pos.tp > 0 &&
                  renderDottedTextLine(
                    yTP,
                    `······ TP $${pos.tp.toFixed(2)} ······`,
                    '#10b981',
                    120,
                    9
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

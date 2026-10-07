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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMarket, usePositions, useTicker } from '../hooks/useTradingStore';
import { Activity } from 'lucide-react';
import { findCorrespondingOrderBlock } from '../engine/tradeJournal';
import { calculateATR, detectFVGs, detectOrderBlocks, MarketStructureEngine } from '../engine/smcCore';
import type { Candle } from '../types/smc';

export type ChartTimeframe = 'M1' | 'M5' | 'M15' | 'H1';

interface SMCInteractiveChartProps {
  height?: number;
  timeframe: ChartTimeframe;
}

export const SMCInteractiveChart: React.FC<SMCInteractiveChartProps> = ({ height = 380, timeframe }) => {
  const market = useMarket();
  const positionsState = usePositions();
  const ticker = useTicker();
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
    return (
      selectedPosition.strategyOrderBlock ||
      findCorrespondingOrderBlock(selectedPosition.type, selectedPosition.price_open, market.zones)
    );
  }, [market.zones, selectedPosition]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      if (entry.contentRect.width > 0) setChartWidth(entry.contentRect.width);
      if (entry.contentRect.height > 0) setChartHeight(entry.contentRect.height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timeframeMs = timeframe === 'M1' ? 60_000 : timeframe === 'M5' ? 5 * 60_000 : timeframe === 'M15' ? 15 * 60_000 : 60 * 60_000;
  const secondsToClose = Math.ceil((timeframeMs - (now % timeframeMs)) / 1000);

  const handleChartPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * vbWidth / bounds.width;
    const y = (event.clientY - bounds.top) * vbHeight / bounds.height;
    if (pointerStart.current && event.buttons === 1) {
      const delta = Math.round((pointerStart.current.x - event.clientX) / Math.max(1, bounds.width / visibleCount));
      if (Math.abs(delta) > 0) {
        setPanOffset(Math.max(0, Math.min(sourceCandles.length - visibleCount, pointerStart.current.offset + delta)));
        pointerStart.current = { x: event.clientX, offset: Math.max(0, Math.min(sourceCandles.length - visibleCount, pointerStart.current.offset + delta)) };
        setCrosshair(null);
        return;
      }
    }
    const plotX = x - 12;
    const candleIndex = Math.max(0, Math.min(candles.length - 1, Math.floor(plotX / candleSpacing)));
    if (candles[candleIndex]) setCrosshair({ x, y, candle: candles[candleIndex] });
  };

  const sourceCandles = useMemo(() => {
    const candlesByTimeframe: Record<ChartTimeframe, Candle[]> = {
      M1: market.candlesM1,
      M5: market.candlesM5,
      M15: market.candlesM15,
      H1: market.candlesH1,
    };
    return (candlesByTimeframe[timeframe] || []).slice(-120);
  }, [market.candlesM1, market.candlesM5, market.candlesM15, market.candlesH1, timeframe]);
  const candles = useMemo(() => {
    const end = Math.max(0, sourceCandles.length - panOffset);
    return sourceCandles.slice(Math.max(0, end - visibleCount), end);
  }, [sourceCandles, panOffset, visibleCount]);
  const chartSymbol = market.brokerMarketData || timeframe === 'M1' || timeframe === 'M5'
    ? 'XAUUSD'
    : 'PAXGUSDT';
  const feedLabel = market.brokerMarketData
    ? 'MT5 BROKER FEED'
    : timeframe === 'M1' || timeframe === 'M5'
      ? candles.length >= 25 ? 'MT5 HISTORY INCOMPLETE' : 'CONNECT MT5 FOR XAUUSD'
      : 'PUBLIC PAXGUSDT FEED · NOT BROKER';

  const chartZones = useMemo(() => {
    if (candles.length < 25) return [];
    const atr = calculateATR(candles);
    return [
      ...detectFVGs(candles, atr).filter((zone) => !zone.filled).slice(-8),
      ...detectOrderBlocks(candles, atr).filter((zone) => !zone.filled).slice(-8),
    ];
  }, [candles]);
  const chartStructure = useMemo(() => {
    const structure = new MarketStructureEngine(3);
    structure.update(candles);
    return {
      bos: structure.events.filter((event) => event.kind === 'BOS').slice(-1)[0] || null,
      choch: structure.events.filter((event) => event.kind === 'CHoCH').slice(-1)[0] || null,
    };
  }, [candles]);
  const chartSignal = market.signal?.timeframe === timeframe ? market.signal : null;

  const nearestZones = useMemo(() => {
    const categories = new Set<string>();
    return chartZones
      .filter((zone) => !zone.filled)
      .slice()
      .sort((a, b) =>
        Math.abs((a.top + a.bottom) / 2 - ticker.bid) -
        Math.abs((b.top + b.bottom) / 2 - ticker.bid)
      )
      .filter((zone) => {
        const category = `${zone.kind}-${zone.bullish ? 'demand' : 'supply'}`;
        if (categories.has(category)) return false;
        categories.add(category);
        return true;
      });
  }, [chartZones, ticker.bid]);

  // Compute precise price bounds with safety padding
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (candles.length === 0) {
      const range = market.dealing_range;
      const low = range?.low ?? ticker.bid - 20;
      const high = range?.high ?? ticker.bid + 20;
      const pad = Math.max(1.8, (high - low) * 0.08);
      return { minPrice: low - pad, maxPrice: high + pad, priceRange: high - low + pad * 2 };
    }
    let min = Math.min(...candles.map((c) => c.low));
    let max = Math.max(...candles.map((c) => c.high));
    min = Math.min(min, ticker.bid, chartStructure.bos?.price ?? ticker.bid, chartStructure.choch?.price ?? ticker.bid);
    max = Math.max(max, ticker.bid, chartStructure.bos?.price ?? ticker.bid, chartStructure.choch?.price ?? ticker.bid);
    if (chartSignal) {
      min = Math.min(min, chartSignal.entry, chartSignal.sl, chartSignal.tp);
      max = Math.max(max, chartSignal.entry, chartSignal.sl, chartSignal.tp);
    }

    // Ensure zones fit cleanly in bounds
    chartZones.forEach((z) => {
      min = Math.min(min, z.bottom);
      max = Math.max(max, z.top);
    });

    // Ensure active trade levels fit cleanly
    positionsState.positions.forEach((p) => {
      min = Math.min(min, p.sl, p.tp, p.price_open);
      max = Math.max(max, p.sl, p.tp, p.price_open);
    });
    if (selectedOrderBlock) {
      min = Math.min(min, selectedOrderBlock.bottom);
      max = Math.max(max, selectedOrderBlock.top);
    }

    const pad = Math.max(1.8, (max - min) * 0.08);
    return {
      minPrice: min - pad,
      maxPrice: max + pad,
      priceRange: Math.max(3, max - min + pad * 2),
    };
  }, [candles, chartZones, chartSignal, chartStructure, market.dealing_range, positionsState.positions, selectedOrderBlock, ticker.bid]);

  const vbWidth = chartWidth;
  const vbHeight = chartHeight;
  const rightAxisWidth = 85;
  const plotWidth = vbWidth - rightAxisWidth;

  const getY = (price: number) => {
    const ratio = (price - minPrice) / priceRange;
    return vbHeight - ratio * (vbHeight - 32) - 16;
  };

  const candleSpacing = plotWidth / Math.max(1, candles.length);
  const candleBodyWidth = Math.max(5, Math.min(14, candleSpacing * 0.65));
  const zoneLabelPositions: number[] = [];
  const structureLabelPositions: number[] = [];
  const spotY = getY(ticker.bid);
  const zoneYPositions = nearestZones.map((zone) => Math.min(getY(zone.top), getY(zone.bottom)) + 11);
  const canShowStructureLabel = (price: number) => {
    const y = getY(price);
    if (
      Math.abs(y - spotY) < 20
      || nearestZones.some((zone) => price >= zone.bottom && price <= zone.top)
      || zoneYPositions.some((position) => Math.abs(position - y) < 16)
      || structureLabelPositions.some((position) => Math.abs(position - y) < 18)
    ) {
      return false;
    }
    structureLabelPositions.push(y);
    return true;
  };
  const showBosLabel = chartStructure.bos ? canShowStructureLabel(chartStructure.bos.price) : false;
  const showChochLabel = chartStructure.choch ? canShowStructureLabel(chartStructure.choch.price) : false;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-black font-mono text-xs shadow-sm">
      {/* Clean, Clutter-Free Status & Legend Bar (Buttons Removed) */}
      <div className="px-4 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2 text-[11px]">
        {/* Left: Indicator Legend */}
        <div className="flex items-center gap-3 text-zinc-400">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>{chartSymbol} {timeframe} Structure</span>
          </span>
          <span className={`text-[9px] font-bold ${market.brokerMarketData ? 'text-emerald-400' : 'text-amber-400'}`}>
            {feedLabel}
          </span>
          {market.accountMode && (
            <span className={`text-[9px] font-black uppercase ${
              market.accountMode === 'live' ? 'text-rose-400' : 'text-sky-300'
            }`}>
              {market.accountMode} account
            </span>
          )}
          {chartSignal && (
            <span
              className="rounded border border-emerald-500/40 bg-emerald-950/50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300"
              title={chartSignal.reasons.join('\n')}
            >
              SIGNAL {chartSignal.timeframe} {chartSignal.direction} · {chartSignal.score} · reasons hover
            </span>
          )}

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
                <span>
                  {selectedPosition ? `Trade #${selectedPosition.ticket} focused` : 'Active Trades'}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Live Bid Price */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-zinc-400">Last:</span>
          <strong className="text-white font-bold tabular-nums">
            ${ticker.bid.toFixed(2)}
          </strong>
          <span className="ml-2 text-amber-300 tabular-nums" title="Clock-based estimate to the next candle boundary">
            {timeframe} closes in {String(Math.floor(secondsToClose / 60)).padStart(2, '0')}:{String(secondsToClose % 60).padStart(2, '0')}
          </span>
          {crosshair && (
            <span className="hidden md:inline ml-2 text-zinc-300 tabular-nums">
              O {crosshair.candle.open.toFixed(2)} H {crosshair.candle.high.toFixed(2)} L {crosshair.candle.low.toFixed(2)} C {crosshair.candle.close.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* SVG Candlestick & Structure Canvas */}
      <div ref={chartContainerRef} className="flex-1 min-h-0 w-full bg-black p-1 sm:p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          className="block w-full"
          style={{ height: '100%', touchAction: 'none', cursor: crosshair ? 'crosshair' : 'grab' }}
          onPointerDown={(event) => {
            pointerStart.current = { x: event.clientX, offset: panOffset };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={handleChartPointerMove}
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
              {timeframe === 'M1' || timeframe === 'M5'
                ? 'Connect MT5 to load broker-matched candles'
                : 'Waiting for market candles'}
            </text>
          )}
          {/* Subtle Horizontal Price Grid Lines */}
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((pct, idx) => {
            const y = vbHeight * pct;
            const priceVal = maxPrice - pct * priceRange;
            return (
              <g key={`grid-${idx}`}>
                <line x1={0} y1={y} x2={plotWidth} y2={y} stroke="#27272a" strokeWidth="1" strokeDasharray="3 3" />
                <text x={plotWidth + 10} y={y + 3.5} fill="#a1a1aa" fontSize={chartWidth < 500 ? 11 : 10} fontFamily="monospace">
                  ${priceVal.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Right Axis Separator Line */}
          <line x1={plotWidth} y1={0} x2={plotWidth} y2={vbHeight} stroke="#27272a" strokeWidth="1" />

          {/* 1. ORDER BLOCKS (OB) SHADED ZONES */}
          {nearestZones
            .filter((zone) => zone.kind === 'OB')
            .map((ob, idx) => {
              const yTop = getY(ob.top);
              const yBottom = getY(ob.bottom);
              const h = Math.max(5, Math.abs(yBottom - yTop));
              const y = Math.min(yTop, yBottom);
              const isBull = ob.bullish;
              const labelY = y + 11;
              const showLabel = !zoneLabelPositions.some((position) => Math.abs(position - labelY) < 14);
              if (showLabel) zoneLabelPositions.push(labelY);

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
                  {showLabel && (
                    <text
                      x={26}
                      y={labelY}
                      fill={isBull ? '#34d399' : '#fb7185'}
                      fontSize={chartWidth < 500 ? 11 : 9}
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {chartWidth < 500 ? (isBull ? 'D-OB' : 'S-OB') : (isBull ? 'DEMAND OB' : 'SUPPLY OB')} (${ob.bottom.toFixed(1)} – ${ob.top.toFixed(1)})
                    </text>
                  )}
                </g>
              );
            })}

          {/* 2. FAIR VALUE GAPS (FVG) */}
          {nearestZones
            .filter((zone) => zone.kind === 'FVG')
            .map((fvg, idx) => {
              const yTop = getY(fvg.top);
              const yBottom = getY(fvg.bottom);
              const h = Math.max(4, Math.abs(yBottom - yTop));
              const y = Math.min(yTop, yBottom);
              const labelY = y + 10;
              const showLabel = !zoneLabelPositions.some((position) => Math.abs(position - labelY) < 14);
              if (showLabel) zoneLabelPositions.push(labelY);

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
                  {showLabel && (
                    <text x={40} y={labelY} fill="#fde047" fontSize={chartWidth < 500 ? 10 : 8.5} fontWeight="bold" fontFamily="monospace">
                      FVG (${fvg.bottom.toFixed(1)} – ${fvg.top.toFixed(1)})
                    </text>
                  )}
                </g>
              );
            })}

          {selectedPosition && selectedOrderBlock && (() => {
            const top = Math.min(getY(selectedOrderBlock.top), getY(selectedOrderBlock.bottom));
            const bottom = Math.max(getY(selectedOrderBlock.top), getY(selectedOrderBlock.bottom));
            const zoneHeight = Math.max(5, bottom - top);
            const labelY = Math.min(vbHeight - 8, Math.max(20, top + 15));
            const side = selectedOrderBlock.bullish ? 'DEMAND' : 'SUPPLY';
            return (
              <g key={`focused-ob-${selectedPosition.ticket}`}>
                <title>
                  Position #{selectedPosition.ticket} linked {side.toLowerCase()} order block, $
                  {selectedOrderBlock.bottom.toFixed(2)}–${selectedOrderBlock.top.toFixed(2)}
                </title>
                <rect
                  x={17}
                  y={top}
                  width={plotWidth - 22}
                  height={zoneHeight}
                  fill="#0ea5e9"
                  fillOpacity="0.16"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  rx="3"
                />
                <rect
                  x={23}
                  y={labelY - 12}
                  width={chartWidth < 500 ? 112 : 145}
                  height={18}
                  rx="3"
                  fill="#075985"
                />
                <text
                  x={28}
                  y={labelY}
                  fill="#e0f2fe"
                  fontSize={chartWidth < 500 ? 10 : 9}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  #{selectedPosition.ticket} LINKED {side} OB
                </text>
              </g>
            );
          })()}

          {/* 3. BOS & CHOCH STRUCTURAL BREAK LINES */}
          {chartStructure.bos && (
            <g>
              <line
                x1={0}
                y1={getY(chartStructure.bos.price)}
                x2={plotWidth}
                y2={getY(chartStructure.bos.price)}
                stroke="#c084fc"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              {showBosLabel && (
                <>
                  <rect
                    x={plotWidth - 110}
                    y={getY(chartStructure.bos.price) - 8}
                    width={100}
                    height={16}
                    rx="3"
                    fill="#581c87"
                  />
                  <text
                    x={plotWidth - 105}
                    y={getY(chartStructure.bos.price) + 3.5}
                    fill="#faf5ff"
                    fontSize={chartWidth < 500 ? 10 : 9}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    BOS ${chartStructure.bos.price.toFixed(1)}
                  </text>
                </>
              )}
            </g>
          )}

          {chartStructure.choch && (
            <g>
              <line
                x1={0}
                y1={getY(chartStructure.choch.price)}
                x2={plotWidth}
                y2={getY(chartStructure.choch.price)}
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              {showChochLabel && (
                <>
                  <rect
                    x={plotWidth - 120}
                    y={getY(chartStructure.choch.price) - 8}
                    width={110}
                    height={16}
                    rx="3"
                    fill="#0369a1"
                  />
                  <text
                    x={plotWidth - 115}
                    y={getY(chartStructure.choch.price) + 3.5}
                    fill="#f0f9ff"
                    fontSize={chartWidth < 500 ? 10 : 9}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    CHoCH ${chartStructure.choch.price.toFixed(1)}
                  </text>
                </>
              )}
            </g>
          )}

          {chartSignal && (
            <g>
              {[
                { label: 'SIGNAL ENTRY', price: chartSignal.entry, color: '#38bdf8' },
                { label: 'SIGNAL SL', price: chartSignal.sl, color: '#f43f5e' },
                { label: 'SIGNAL TP', price: chartSignal.tp, color: '#10b981' },
              ].map(({ label, price, color }) => (
                <g key={label}>
                  <line
                    x1={0}
                    y1={getY(price)}
                    x2={plotWidth}
                    y2={getY(price)}
                    stroke={color}
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />
                  <text
                    x={chartWidth < 500 ? 25 : 30}
                    y={getY(price) - 4}
                    fill={color}
                    fontSize={chartWidth < 500 ? 9 : 10}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {label} ${price.toFixed(2)}
                  </text>
                </g>
              ))}
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
            const isFocused = selectedPosition?.ticket === pos.ticket;

            return (
              <g key={`pos-${pos.ticket}`} opacity={isFocused ? 1 : 0.3}>
                {/* Entry Dotted Line */}
                <line x1={0} y1={yEntry} x2={plotWidth} y2={yEntry} stroke="#38bdf8" strokeWidth={isFocused ? 2.5 : 1.5} strokeDasharray="3 3" />
                <rect x={plotWidth - 170} y={yEntry - 8} width={160} height={16} rx="3" fill={isFocused ? '#075985' : '#164e63'} />
                <text x={plotWidth - 165} y={yEntry + 3.5} fill="#e0f2fe" fontSize={chartWidth < 500 ? 10 : 9} fontWeight="bold" fontFamily="monospace">
                  #{pos.ticket} {pos.type} @ ${pos.price_open.toFixed(1)}
                </text>

                {/* Stop Loss Line */}
                <line x1={0} y1={ySL} x2={plotWidth} y2={ySL} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="4 2" />
                <rect x={plotWidth - 100} y={ySL - 8} width={90} height={16} rx="3" fill="#881337" />
                <text x={plotWidth - 95} y={ySL + 3.5} fill="#ffe4e6" fontSize={chartWidth < 500 ? 10 : 9} fontWeight="bold" fontFamily="monospace">
                  SL ${pos.sl.toFixed(1)}
                </text>

                {/* Take Profit Line */}
                <line x1={0} y1={yTP} x2={plotWidth} y2={yTP} stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" />
                <rect x={plotWidth - 100} y={yTP - 8} width={90} height={16} rx="3" fill="#064e3b" />
                <text x={plotWidth - 95} y={yTP + 3.5} fill="#d1fae5" fontSize={chartWidth < 500 ? 10 : 9} fontWeight="bold" fontFamily="monospace">
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
          {crosshair && (
            <g pointerEvents="none">
              <line x1={crosshair.x} y1={0} x2={crosshair.x} y2={vbHeight} stroke="#e4e4e7" strokeOpacity="0.65" strokeDasharray="3 3" />
              <line x1={0} y1={crosshair.y} x2={plotWidth} y2={crosshair.y} stroke="#e4e4e7" strokeOpacity="0.65" strokeDasharray="3 3" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

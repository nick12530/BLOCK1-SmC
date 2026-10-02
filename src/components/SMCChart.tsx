import React, { useRef, useEffect, useState, useMemo } from 'react';
import { TerminalSnapshot, Candle } from '../types/smc';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BarChart2,
  TrendingUp,
} from 'lucide-react';

interface SMCChartProps {
  snapshot: TerminalSnapshot;
}

export const SMCChart: React.FC<SMCChartProps> = ({ snapshot }) => {
  const [selectedTf, setSelectedTf] = useState<'M15' | 'H1'>('M15');
  const [chartMode, setChartMode] = useState<'candles' | 'line'>('candles');
  const [visibleCount, setVisibleCount] = useState<number>(65);

  const [showFVG, setShowFVG] = useState(true);
  const [showOB, setShowOB] = useState(true);
  const [showStructure, setShowStructure] = useState(true);
  const [showDealingRange, setShowDealingRange] = useState(true);
  const [showEMA, setShowEMA] = useState(true);

  const [hoverData, setHoverData] = useState<{
    candle: Candle;
    x: number;
    y: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const candles = useMemo(() => {
    return selectedTf === 'M15' ? snapshot.candlesM15 : snapshot.candlesH1;
  }, [selectedTf, snapshot.candlesM15, snapshot.candlesH1]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    if (candles.length < 2) return;

    const visibleCandles = candles.slice(-visibleCount);
    const n = visibleCandles.length;

    // Price range bounds
    let minPrice = Math.min(...visibleCandles.map((c) => c.low));
    let maxPrice = Math.max(...visibleCandles.map((c) => c.high));

    // Pad by 8%
    const pricePadding = (maxPrice - minPrice) * 0.08 || 2.0;
    minPrice -= pricePadding;
    maxPrice += pricePadding;
    const priceRange = maxPrice - minPrice;

    // Layout margins
    const rightPriceMargin = 68;
    const bottomTimeMargin = 28;
    const volumeHeight = 55;
    const chartW = width - rightPriceMargin;
    const chartH = height - bottomTimeMargin;
    const priceChartH = chartH - volumeHeight;

    const priceToY = (p: number) => {
      return priceChartH - ((p - minPrice) / priceRange) * priceChartH;
    };

    const candleWidth = chartW / n;
    const barWidth = Math.max(3, candleWidth * 0.72);

    // 1. Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSteps = 6;
    for (let i = 0; i <= gridSteps; i++) {
      const y = (priceChartH / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartW, y);
      ctx.stroke();

      const p = maxPrice - (priceRange / gridSteps) * i;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(p.toFixed(2), chartW + 8, y + 3);
    }

    // 2. HTF Dealing Range (Discount & Premium Shading)
    if (showDealingRange && snapshot.dealing_range) {
      const dr = snapshot.dealing_range;
      const eqY = priceToY(dr.equilibrium);
      const hiY = priceToY(dr.high);
      const loY = priceToY(dr.low);

      // Premium zone shade (above EQ)
      if (hiY < eqY) {
        ctx.fillStyle = 'rgba(244, 63, 94, 0.035)';
        ctx.fillRect(0, hiY, chartW, eqY - hiY);
      }

      // Discount zone shade (below EQ)
      if (eqY < loY) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.035)';
        ctx.fillRect(0, eqY, chartW, loY - eqY);
      }

      // Equilibrium dashed line
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, eqY);
      ctx.lineTo(chartW, eqY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`EQ 50% · ${dr.equilibrium.toFixed(2)}`, chartW - 10, eqY - 4);
    }

    // 3. SMC Zones (FVG & OB)
    for (const z of snapshot.zones) {
      if (z.kind === 'FVG' && !showFVG) continue;
      if (z.kind === 'OB' && !showOB) continue;

      const topY = priceToY(z.top);
      const botY = priceToY(z.bottom);
      const zoneH = Math.max(2, Math.abs(botY - topY));
      const drawY = Math.min(topY, botY);

      if (z.bullish) {
        // Bullish Demand
        ctx.fillStyle = z.kind === 'FVG' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.18)';
        ctx.fillRect(0, drawY, chartW, zoneH);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, drawY, chartW, zoneH);

        ctx.fillStyle = '#10b981';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(
          `${z.kind} DEMAND (${z.bottom.toFixed(2)} - ${z.top.toFixed(2)}) · ${z.tests}T`,
          10,
          drawY + 11
        );
      } else {
        // Bearish Supply
        ctx.fillStyle = z.kind === 'FVG' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(244, 63, 94, 0.18)';
        ctx.fillRect(0, drawY, chartW, zoneH);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, drawY, chartW, zoneH);

        ctx.fillStyle = '#f43f5e';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(
          `${z.kind} SUPPLY (${z.bottom.toFixed(2)} - ${z.top.toFixed(2)}) · ${z.tests}T`,
          10,
          drawY + 11
        );
      }
    }

    // 4. BOS & CHoCH Structure Lines
    if (showStructure) {
      if (snapshot.bos) {
        const y = priceToY(snapshot.bos.price);
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = snapshot.bos.direction === 'bullish' ? '#10b981' : '#f43f5e';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(chartW * 0.25, y);
        ctx.lineTo(chartW, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = snapshot.bos.direction === 'bullish' ? '#10b981' : '#f43f5e';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`BOS (${snapshot.bos.direction.toUpperCase()}) ${snapshot.bos.price.toFixed(2)}`, chartW - 10, y - 4);
      }

      if (snapshot.choch) {
        const y = priceToY(snapshot.choch.price);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(chartW * 0.15, y);
        ctx.lineTo(chartW, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f59e0b';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`CHoCH REVERSAL ${snapshot.choch.price.toFixed(2)}`, chartW - 10, y - 4);
      }
    }

    // 5. EMA 20 Dynamic Line
    if (showEMA && visibleCandles.length > 20) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(79, 142, 247, 0.6)';
      ctx.lineWidth = 1.2;
      for (let i = 19; i < visibleCandles.length; i++) {
        let sum = 0;
        for (let k = i - 19; k <= i; k++) {
          sum += visibleCandles[k].close;
        }
        const emaVal = sum / 20;
        const x = i * candleWidth + candleWidth / 2;
        const y = priceToY(emaVal);
        if (i === 19) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 6. Volume Sub-Bars
    const maxVol = Math.max(...visibleCandles.map((c) => c.volume)) || 1;
    visibleCandles.forEach((c, idx) => {
      const x = idx * candleWidth + candleWidth / 2;
      const isUp = c.close >= c.open;
      const volH = (c.volume / maxVol) * volumeHeight * 0.85;
      const volY = chartH - volH;

      ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)';
      ctx.fillRect(x - barWidth / 2, volY, barWidth, volH);
    });

    // 7. Candlesticks or Line Mode
    if (chartMode === 'candles') {
      visibleCandles.forEach((c, idx) => {
        const x = idx * candleWidth + candleWidth / 2;
        const isUp = c.close >= c.open;
        const openY = priceToY(c.open);
        const closeY = priceToY(c.close);
        const highY = priceToY(c.high);
        const lowY = priceToY(c.low);

        const color = isUp ? '#10b981' : '#f43f5e';

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // Body
        const bodyY = Math.min(openY, closeY);
        const bodyH = Math.max(1.5, Math.abs(closeY - openY));
        ctx.fillStyle = color;
        ctx.fillRect(x - barWidth / 2, bodyY, barWidth, bodyH);

        // Time labels
        if (idx % 10 === 0) {
          ctx.fillStyle = '#64748b';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(c.timeStr, x, chartH + 18);
        }
      });
    } else {
      // Line Mode
      ctx.beginPath();
      ctx.strokeStyle = '#4f8ef7';
      ctx.lineWidth = 2;
      visibleCandles.forEach((c, idx) => {
        const x = idx * candleWidth + candleWidth / 2;
        const y = priceToY(c.close);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Area gradient
      ctx.lineTo((visibleCandles.length - 1) * candleWidth, priceChartH);
      ctx.lineTo(0, priceChartH);
      ctx.closePath();
      const areaGrad = ctx.createLinearGradient(0, 0, 0, priceChartH);
      areaGrad.addColorStop(0, 'rgba(79, 142, 247, 0.15)');
      areaGrad.addColorStop(1, 'rgba(79, 142, 247, 0.0)');
      ctx.fillStyle = areaGrad;
      ctx.fill();
    }

    // 8. Active Signal Entry, SL, TP Lines
    if (snapshot.signal) {
      const sig = snapshot.signal;
      const entryY = priceToY(sig.entry);
      const slY = priceToY(sig.sl);
      const tpY = priceToY(sig.tp);

      ctx.strokeStyle = '#4f8ef7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(chartW * 0.45, entryY);
      ctx.lineTo(chartW, entryY);
      ctx.stroke();

      ctx.strokeStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(chartW * 0.45, slY);
      ctx.lineTo(chartW, slY);
      ctx.stroke();

      ctx.strokeStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(chartW * 0.45, tpY);
      ctx.lineTo(chartW, tpY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#4f8ef7';
      ctx.fillText(`ENTRY ${sig.entry.toFixed(2)}`, chartW + 4, entryY + 3);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText(`SL ${sig.sl.toFixed(2)}`, chartW + 4, slY + 3);
      ctx.fillStyle = '#10b981';
      ctx.fillText(`TP ${sig.tp.toFixed(2)}`, chartW + 4, tpY + 3);
    }

    // 9. Current Market Price Pointer
    const currentPriceY = priceToY(snapshot.bid);
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#4f8ef7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, currentPriceY);
    ctx.lineTo(chartW, currentPriceY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#4f8ef7';
    ctx.fillRect(chartW + 2, currentPriceY - 9, rightPriceMargin - 4, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(snapshot.bid.toFixed(2), chartW + rightPriceMargin / 2, currentPriceY + 3);
  }, [
    candles,
    snapshot,
    visibleCount,
    chartMode,
    showFVG,
    showOB,
    showStructure,
    showDealingRange,
    showEMA,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const visibleCandles = candles.slice(-visibleCount);
    const rightPriceMargin = 68;
    const chartW = rect.width - rightPriceMargin;
    const candleWidth = chartW / visibleCandles.length;

    const candleIdx = Math.floor(x / candleWidth);
    if (candleIdx >= 0 && candleIdx < visibleCandles.length) {
      setHoverData({
        candle: visibleCandles[candleIdx],
        x,
        y,
      });
    } else {
      setHoverData(null);
    }
  };

  const handleZoom = (inOut: 'in' | 'out') => {
    setVisibleCount((prev) => {
      if (inOut === 'in') return Math.max(30, prev - 15);
      return Math.min(150, prev + 15);
    });
  };

  return (
    <div
      ref={containerRef}
      className="bg-[#121826] border border-[#1e2a3d] rounded-xl p-3.5 flex flex-col shadow-sm relative overflow-hidden"
    >
      {/* Chart Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-[#1e2a3d] text-xs font-mono">
        {/* Timeframe & Chart Style */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0b0f17] p-0.5 rounded-lg border border-[#1e2a3d]">
            <button
              onClick={() => setSelectedTf('M15')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                selectedTf === 'M15'
                  ? 'bg-[#1a2436] text-[#4f8ef7] shadow-sm'
                  : 'text-[#6b7a90] hover:text-[#94a3b8]'
              }`}
            >
              M15 (Execution)
            </button>
            <button
              onClick={() => setSelectedTf('H1')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                selectedTf === 'H1'
                  ? 'bg-[#1a2436] text-[#4f8ef7] shadow-sm'
                  : 'text-[#6b7a90] hover:text-[#94a3b8]'
              }`}
            >
              H1 (Structure)
            </button>
          </div>

          <div className="flex items-center bg-[#0b0f17] p-0.5 rounded-lg border border-[#1e2a3d]">
            <button
              onClick={() => setChartMode('candles')}
              className={`px-2 py-1 rounded transition-colors ${
                chartMode === 'candles'
                  ? 'bg-[#1a2436] text-white'
                  : 'text-[#6b7a90] hover:text-[#94a3b8]'
              }`}
            >
              Candles
            </button>
            <button
              onClick={() => setChartMode('line')}
              className={`px-2 py-1 rounded transition-colors ${
                chartMode === 'line'
                  ? 'bg-[#1a2436] text-white'
                  : 'text-[#6b7a90] hover:text-[#94a3b8]'
              }`}
            >
              Line
            </button>
          </div>

          {/* Crosshair telemetry */}
          {hoverData && (
            <div className="hidden xl:flex items-center gap-2.5 text-[11px] text-[#94a3b8] bg-[#0b0f17] px-2.5 py-1 rounded border border-[#1e2a3d]">
              <span>T: {hoverData.candle.timeStr}</span>
              <span>O: {hoverData.candle.open.toFixed(2)}</span>
              <span>H: {hoverData.candle.high.toFixed(2)}</span>
              <span>L: {hoverData.candle.low.toFixed(2)}</span>
              <span
                className={
                  hoverData.candle.close >= hoverData.candle.open
                    ? 'text-emerald-400 font-bold'
                    : 'text-red-400 font-bold'
                }
              >
                C: {hoverData.candle.close.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Indicators & Overlays Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowFVG(!showFVG)}
            className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
              showFVG
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-[#0b0f17] border-[#1e2a3d] text-[#6b7a90]'
            }`}
          >
            FVG
          </button>
          <button
            onClick={() => setShowOB(!showOB)}
            className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
              showOB
                ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                : 'bg-[#0b0f17] border-[#1e2a3d] text-[#6b7a90]'
            }`}
          >
            OB
          </button>
          <button
            onClick={() => setShowStructure(!showStructure)}
            className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
              showStructure
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                : 'bg-[#0b0f17] border-[#1e2a3d] text-[#6b7a90]'
            }`}
          >
            BOS/CHoCH
          </button>
          <button
            onClick={() => setShowDealingRange(!showDealingRange)}
            className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
              showDealingRange
                ? 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                : 'bg-[#0b0f17] border-[#1e2a3d] text-[#6b7a90]'
            }`}
          >
            EQ Range
          </button>

          <div className="h-4 w-px bg-[#1e2a3d] mx-1" />

          {/* Zoom Buttons */}
          <button
            onClick={() => handleZoom('in')}
            className="p-1 rounded bg-[#0b0f17] border border-[#1e2a3d] text-[#6b7a90] hover:text-white"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="p-1 rounded bg-[#0b0f17] border border-[#1e2a3d] text-[#6b7a90] hover:text-white"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setVisibleCount(65)}
            className="p-1 rounded bg-[#0b0f17] border border-[#1e2a3d] text-[#6b7a90] hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Chart Viewport */}
      <div className="relative w-full h-[480px] mt-2 cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverData(null)}
          className="w-full h-full block"
        />
      </div>
    </div>
  );
};

import React, { useRef, useEffect } from 'react';
import { TerminalSnapshot } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import { TrendingUp, TrendingDown, Target, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

interface SignalEngineProps {
  snapshot: TerminalSnapshot;
  onTradeSignal: () => void;
}

export const SignalEngine: React.FC<SignalEngineProps> = ({ snapshot, onTradeSignal }) => {
  const sparkRef = useRef<HTMLCanvasElement | null>(null);

  // Render canvas sparkline identical to dashboard.html
  useEffect(() => {
    const c = sparkRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const data = snapshot.history;
    const w = (c.width = c.offsetWidth);
    const h = c.height;
    ctx.clearRect(0, 0, w, h);

    if (!data || data.length < 2) return;

    const mn = Math.min(...data);
    const mx = Math.max(...data);
    const rg = mx - mn || 1;

    ctx.beginPath();
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - 6 - ((v - mn) / rg) * (h - 12);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    const isBull = snapshot.bias === 'bullish';
    ctx.strokeStyle = isBull ? '#16c784' : snapshot.bias === 'bearish' ? '#ea3943' : '#4f8ef7';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();

    const gr = ctx.createLinearGradient(0, 0, 0, h);
    if (isBull) {
      gr.addColorStop(0, 'rgba(22,199,132,0.2)');
      gr.addColorStop(1, 'rgba(22,199,132,0.0)');
    } else {
      gr.addColorStop(0, 'rgba(79,142,247,0.2)');
      gr.addColorStop(1, 'rgba(79,142,247,0.0)');
    }
    ctx.fillStyle = gr;
    ctx.fill();
  }, [snapshot.history, snapshot.bias]);

  const sig = snapshot.signal;

  return (
    <div className="bg-[#121826] border border-[#1e2a3d] rounded-xl p-3.5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-[#1e2a3d]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6b7a90] flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-[#4f8ef7]" />
          Signal Engine (HTF + POI)
        </h3>
        <span className="text-[11px] font-mono text-[#6b7a90]">k=3 Swings</span>
      </div>

      {/* HTF Bias & Structure Events */}
      <div className="space-y-1.5 text-xs font-mono">
        <div className="flex justify-between items-center py-0.5">
          <span className="text-[#6b7a90]">HTF Bias:</span>
          <span
            className={`font-semibold flex items-center gap-1 ${
              snapshot.bias === 'bullish'
                ? 'text-emerald-400'
                : snapshot.bias === 'bearish'
                ? 'text-red-400'
                : 'text-[#94a3b8]'
            }`}
          >
            {snapshot.bias === 'bullish' && <TrendingUp className="w-3 h-3" />}
            {snapshot.bias === 'bearish' && <TrendingDown className="w-3 h-3" />}
            {snapshot.bias.toUpperCase()}
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-[#6b7a90]">Last BOS:</span>
          <span className="text-white">
            {snapshot.bos
              ? `${snapshot.bos.kind} ${snapshot.bos.price.toFixed(2)} (${snapshot.bos.direction})`
              : '—'}
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-[#6b7a90]">Last CHoCH:</span>
          <span className="text-amber-400">
            {snapshot.choch
              ? `${snapshot.choch.price.toFixed(2)} (${snapshot.choch.direction})`
              : '—'}
          </span>
        </div>
      </div>

      {/* Sparkline Canvas */}
      <div className="h-[64px] w-full rounded-lg bg-[#0b0f17] border border-[#1e2a3d]/70 overflow-hidden relative">
        <canvas ref={sparkRef} className="w-full h-full block" />
        <div className="absolute top-1 left-2 text-[9px] font-mono text-[#6b7a90]">
          M15 Recent Momentum (200 Bars)
        </div>
      </div>

      {/* Signal Box */}
      {sig ? (
        <div className="border border-[#1e2a3d] rounded-lg p-3 bg-[#0b0f17]/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div
              className={`text-lg font-bold font-mono tracking-wide ${
                sig.direction === 'BUY' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {sig.direction} · CONFLUENCE {sig.score}
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1a2436] text-[#94a3b8] border border-[#1e2a3d]">
              ATR {sig.atr}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1 border-t border-[#1e2a3d]">
            <div>
              <div className="text-[10px] text-[#6b7a90]">Entry</div>
              <div className="font-semibold text-white">{sig.entry.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#6b7a90]">SL (Risk)</div>
              <div className="font-semibold text-red-400">{sig.sl.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#6b7a90]">TP (2:1 R:R)</div>
              <div className="font-semibold text-emerald-400">{sig.tp.toFixed(2)}</div>
            </div>
          </div>

          {/* Confluence Checklist */}
          <div className="pt-2 border-t border-[#1e2a3d]">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-[#6b7a90] mb-1.5">
              Confluence Factors (Threshold ≥ 4.0)
            </div>
            <ul className="space-y-1">
              {sig.reasons.map((r, i) => (
                <li key={i} className="text-[11px] text-[#94a3b8] flex items-start gap-1.5 leading-snug">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={onTradeSignal}
            className="w-full mt-1 py-2.5 px-3 rounded-lg text-xs font-semibold font-mono tracking-wider uppercase transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 active:scale-[0.99] shadow-sm flex items-center justify-center gap-2"
          >
            <Target className="w-4 h-4" />
            <span>Execute Signal ({sig.direction} @ {sig.entry})</span>
          </button>
        </div>
      ) : (
        <div className="border border-dashed border-[#1e2a3d] rounded-lg p-5 bg-[#0b0f17]/40 text-center flex flex-col items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5 text-[#6b7a90]" />
          <div className="text-xs text-[#94a3b8] font-medium">No active institutional setup</div>
          <div className="text-[11px] text-[#6b7a90] max-w-[240px]">
            Waiting for HTF structural alignment, FVG/OB POI retest, and kill zone confluence (Score ≥ 4.0).
          </div>
          <button
            disabled
            className="w-full mt-2 py-2 px-3 rounded-lg text-xs font-mono text-[#475569] bg-[#0d131f] border border-[#1e2a3d] cursor-not-allowed"
          >
            EXECUTE SIGNAL (LOCKED)
          </button>
        </div>
      )}
    </div>
  );
};

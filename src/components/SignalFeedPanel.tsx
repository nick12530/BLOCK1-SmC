import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  ShieldAlert,
  AlertTriangle,
  Minus,
  Plus,
  Check,
  Target,
} from 'lucide-react';
import { useMarket, useTicker, useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { Signal, TradeDirection } from '../types/smc';
import { INSTRUMENTS, SupportedSymbol } from '../engine/instrumentConfig';

interface SignalFeedPanelProps {
  onExecuteTrade?: (
    symbol: SupportedSymbol,
    direction: TradeDirection,
    sl: number,
    tp: number,
    rationale: string,
    volume?: number
  ) => void;
}

export const SignalFeedPanel: React.FC<SignalFeedPanelProps> = ({ onExecuteTrade }) => {
  const market = useMarket();
  const ticker = useTicker();
  const engine = useEngine();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'A+' | 'A' | 'B'>('ALL');
  const [customLots, setCustomLots] = useState<Record<string, number>>({});
  const [timeLeftMap, setTimeLeftMap] = useState<Record<string, number>>({});

  const activeSymbol = (ticker.symbol || 'XAUUSD') as SupportedSymbol;
  const config = INSTRUMENTS[activeSymbol] || INSTRUMENTS.XAUUSD;
  const isKillArmed = engine.kill_switch;
  const isWideSpread = ticker.spread > config.maxSpreadPoints;

  // Track expiry countdown every second
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const updated: Record<string, number> = {};
      market.signals.forEach((sig) => {
        const id = `${sig.direction}:${sig.timeframe}:${sig.entry}:${sig.timestamp}`;
        const expiry = sig.expiryTimestamp || (new Date(sig.timestamp).getTime() + 5 * 60_000);
        const remSec = Math.max(0, Math.round((expiry - now) / 1000));
        updated[id] = remSec;
      });
      setTimeLeftMap(updated);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [market.signals]);

  const filteredSignals = market.signals.filter((sig) => {
    const expiry = sig.expiryTimestamp || (new Date(sig.timestamp).getTime() + 5 * 60_000);
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;
    if (gradeFilter === 'ALL') return true;
    return (sig.sniperGrade || (sig.score >= 4.5 ? 'A+' : sig.score >= 3.8 ? 'A' : 'B')) === gradeFilter;
  });

  const getLotForSignal = (sigId: string, stopDist: number): number => {
    if (customLots[sigId] !== undefined) return customLots[sigId];
    const riskVol = tradingEngine.getRiskBasedVolume(stopDist > 0 ? ticker.bid - stopDist : 10);
    return riskVol ?? 0;
  };

  const handleAdjustLot = (sigId: string, delta: number, currentLot: number) => {
    const minVol = config.pipSize > 0.01 ? 0.01 : 0.01;
    const next = Math.max(0.01, Math.min(10.0, Number((currentLot + delta).toFixed(2))));
    setCustomLots((prev) => ({ ...prev, [sigId]: next }));
  };

  const handleExecute = (sig: Signal, lot: number) => {
    if (isKillArmed) return;
    if (isWideSpread) return;

    if (onExecuteTrade) {
      onExecuteTrade(
        activeSymbol,
        sig.direction,
        sig.sl,
        sig.tp,
        sig.actionReason || sig.reasons?.[0] || 'SMC Setup Execution',
        lot
      );
    } else {
      tradingEngine.sendMarket(
        sig.direction,
        lot,
        sig.sl,
        sig.tp,
        `manual:${sig.score}`,
        activeSymbol
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#10141D] rounded border border-white/[0.06] overflow-hidden">
      {/* Title Bar */}
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between bg-[#141923] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-300">
            SIGNALS
          </span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#2979FF]/15 text-[#2979FF] border border-[#2979FF]/30">
            {filteredSignals.length}
          </span>
        </div>

        {/* Grade filter pills */}
        <div className="flex items-center gap-0.5 bg-[#0A0E14] p-0.5 rounded border border-white/[0.06]">
          {(['ALL', 'A+', 'A', 'B'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGradeFilter(g)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                gradeFilter === g
                  ? 'bg-[#2979FF] text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Signal Cards List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredSignals.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4">
            <span className="w-2 h-2 rounded-full bg-[#2979FF] animate-ping mb-2" />
            <p className="font-mono text-xs text-zinc-400 font-semibold">
              Scanning M1/M5/M15 institutional order flow…
            </p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Validating liquidity sweeps, order blocks, and confluence gates
            </p>
          </div>
        ) : (
          filteredSignals.map((sig) => {
            const sigId = `${sig.direction}:${sig.timeframe}:${sig.entry}:${sig.timestamp}`;
            const grade = sig.sniperGrade || (sig.score >= 4.5 ? 'A+' : sig.score >= 3.8 ? 'A' : 'B');
            const isExpanded = expandedId === sigId;
            const stopDist = Math.abs(sig.entry - sig.sl);
            const lot = getLotForSignal(sigId, stopDist);
            const remSec = timeLeftMap[sigId] ?? sig.validitySeconds ?? 180;
            const mins = Math.floor(remSec / 60);
            const secs = remSec % 60;
            const countdownStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

            // Border color by grade
            const borderAccent =
              grade === 'A+'
                ? 'border-l-[#2979FF]'
                : grade === 'A'
                ? 'border-l-[#00E676]'
                : 'border-l-zinc-500';

            // Risk in dollars
            const riskPoints = stopDist;
            const dollarRisk = (riskPoints * lot * config.contractSize).toFixed(2);
            const riskPct = ((Number(dollarRisk) / (tradingEngine.account.equity || 1000)) * 100).toFixed(1);

            const isBuy = sig.direction === 'BUY';
            const riskDist = Math.abs(sig.entry - sig.sl);
            const rewardDist = Math.abs(sig.tp - sig.entry);
            const rrRatio = riskDist > 0 ? (rewardDist / riskDist).toFixed(1) : '2.0';

            return (
              <div
                key={sigId}
                className={`bg-[#141923] rounded border border-white/[0.06] border-l-4 ${borderAccent} p-2.5 transition-all space-y-2`}
              >
                {/* Header: Grade, Direction, Timeframe, RR, Countdown */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {/* Grade Badge */}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black ${
                        grade === 'A+'
                          ? 'bg-[#2979FF]/20 text-[#2979FF] border border-[#2979FF]/30'
                          : grade === 'A'
                          ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      GRADE {grade}
                    </span>

                    {/* Direction Badge */}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                        isBuy
                          ? 'bg-[#2979FF]/15 text-[#2979FF]'
                          : 'bg-[#FF5252]/15 text-[#FF5252]'
                      }`}
                    >
                      {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span>{sig.direction}</span>
                    </span>

                    {/* Timeframe */}
                    <span className="text-[10px] font-mono text-zinc-400 font-bold px-1 bg-white/[0.04] rounded">
                      {sig.timeframe}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-zinc-400">1:{rrRatio} RR</span>
                    {/* Countdown */}
                    <span
                      className={`flex items-center gap-0.5 text-[10px] font-bold px-1 rounded ${
                        remSec < 30 ? 'text-[#FF5252] bg-[#FF5252]/10' : 'text-zinc-400 bg-white/[0.04]'
                      }`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>{countdownStr}</span>
                    </span>
                  </div>
                </div>

                {/* Confluence Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>CONFLUENCE</span>
                    <span className="font-bold text-zinc-200">
                      {Math.round(sig.sniperQualityIndex || (sig.score / 6) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#0A0E14] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        grade === 'A+'
                          ? 'bg-[#2979FF]'
                          : grade === 'A'
                          ? 'bg-[#00E676]'
                          : 'bg-zinc-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round(sig.sniperQualityIndex || (sig.score / 6) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Price Matrix: Entry / SL / TP */}
                <div className="grid grid-cols-3 gap-1 bg-[#0A0E14] p-1.5 rounded border border-white/[0.04] text-center font-mono text-[11px]">
                  <div>
                    <span className="text-[9px] uppercase text-zinc-500 font-bold block">ENTRY</span>
                    <span className="font-bold text-zinc-200 tabular-nums">{sig.entry.toFixed(config.digits)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-zinc-500 font-bold block">SL</span>
                    <span className="font-bold text-[#FF5252] tabular-nums">{sig.sl.toFixed(config.digits)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-zinc-500 font-bold block">TP</span>
                    <span className="font-bold text-[#00E676] tabular-nums">{sig.tp.toFixed(config.digits)}</span>
                  </div>
                </div>

                {/* Lot Adjustment & Risk Display */}
                <div className="flex items-center justify-between gap-1 text-[11px] font-mono pt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-500 text-[10px]">LOT:</span>
                    <div className="flex items-center bg-[#0A0E14] rounded border border-white/[0.06] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleAdjustLot(sigId, -0.01, lot)}
                        className="px-1.5 py-0.5 hover:bg-white/[0.08] text-zinc-300 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-1.5 font-bold tabular-nums text-zinc-100">{lot.toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => handleAdjustLot(sigId, 0.01, lot)}
                        className="px-1.5 py-0.5 hover:bg-white/[0.08] text-zinc-300 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Chips for quick lot change */}
                  <div className="flex items-center gap-0.5">
                    {[-0.05, +0.05].map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        onClick={() => handleAdjustLot(sigId, delta, lot)}
                        className="px-1 py-0.5 rounded text-[9px] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 cursor-pointer"
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>

                  {/* Risk $ */}
                  <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                    Risk: <strong className="text-zinc-200">${dollarRisk}</strong> ({riskPct}%)
                  </span>
                </div>

                {/* Expandable Reasons Accordion */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : sigId)}
                    className="w-full flex items-center justify-between text-[10px] font-mono text-zinc-400 hover:text-zinc-200 pt-1 cursor-pointer"
                  >
                    <span>Why this signal ({sig.reasons?.length || 1} criteria)</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {isExpanded && (
                    <ul className="mt-1.5 p-2 bg-[#0A0E14] rounded text-[10px] font-mono text-zinc-300 space-y-1 border border-white/[0.04]">
                      {sig.reasons && sig.reasons.length > 0 ? (
                        sig.reasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-[#2979FF] font-bold">›</span>
                            <span>{r}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-zinc-500">Institutional POI retest and liquidity confluence</li>
                      )}
                    </ul>
                  )}
                </div>

                {/* 1-Click Execution Button */}
                <button
                  type="button"
                  disabled={isKillArmed || isWideSpread}
                  onClick={() => handleExecute(sig, lot)}
                  title={
                    isKillArmed
                      ? 'Kill switch is armed. Trading blocked.'
                      : isWideSpread
                      ? `Spread too wide (${ticker.spread} > ${config.maxSpreadPoints}). Execution blocked.`
                      : `Execute ${sig.direction} ${lot.toFixed(2)}L`
                  }
                  className={`w-full py-1.5 rounded font-mono text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isKillArmed || isWideSpread
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                      : isBuy
                      ? 'bg-[#2979FF] hover:bg-[#256ee6] text-white shadow-xs active:scale-[0.99]'
                      : 'bg-[#FF5252] hover:bg-[#e04848] text-white shadow-xs active:scale-[0.99]'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>
                    {isKillArmed
                      ? 'KILL SWITCH ARMED'
                      : isWideSpread
                      ? `SPREAD TOO WIDE (${ticker.spread} PTS)`
                      : `EXECUTE ${sig.direction} (${lot.toFixed(2)}L)`}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

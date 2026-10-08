import React, { useState } from 'react';
import { TerminalSnapshot } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import { AiAnalyst } from './AiAnalyst';
import {
  Target,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Gauge,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Layers,
} from 'lucide-react';

interface RightActionDockProps {
  snapshot: TerminalSnapshot;
  onTradeSignal: () => void;
}

export const RightActionDock: React.FC<RightActionDockProps> = ({
  snapshot,
  onTradeSignal,
}) => {
  const [activeTab, setActiveTab] = useState<'signal' | 'manual' | 'ai'>('signal');

  // Manual ticket state
  const [lot, setLot] = useState<number>(0.05);
  const [slPips, setSlPips] = useState<number>(5.0);
  const [rr, setRr] = useState<number>(2.0);
  const [ticketMsg, setTicketMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const sig = snapshot.signal;
  const dr = snapshot.dealing_range;
  const pos = snapshot.price_pos !== null ? Math.min(0.99, Math.max(0.01, snapshot.price_pos)) : 0.5;
  const posPercent = (pos * 100).toFixed(1);
  const isInDiscount = snapshot.price_pos !== null && snapshot.price_pos < 0.5;
  const isInPremium = snapshot.price_pos !== null && snapshot.price_pos > 0.5;

  const pipValuePerLot = 10;
  const riskDollar = lot * pipValuePerLot * slPips;
  const rewardDollar = riskDollar * rr;

  const handleManualTrade = (direction: 'BUY' | 'SELL') => {
    const point = 0.01;
    const pip = 10 * point;
    const price = direction === 'BUY' ? snapshot.ask : snapshot.bid;
    const sl = direction === 'BUY' ? price - slPips * pip : price + slPips * pip;
    const tp = direction === 'BUY' ? price + slPips * pip * rr : price - slPips * pip * rr;

    const res = tradingEngine.sendMarket(
      direction,
      lot,
      Number(sl.toFixed(2)),
      Number(tp.toFixed(2)),
      'manual_dock'
    );

    if (res.ok) {
      setTicketMsg({
        text: `FILLED: ${direction} ${lot}L @ ${res.price?.toFixed(2)} | SL: ${sl.toFixed(2)} TP: ${tp.toFixed(2)}`,
        ok: true,
      });
    } else {
      setTicketMsg({
        text: `REJECTED: ${res.error || 'Execution failed'}`,
        ok: false,
      });
    }

    setTimeout(() => {
      setTicketMsg(null);
    }, 4500);
  };

  return (
    <div className="bg-[#121826] border border-[#1e2a3d] rounded-xl flex flex-col shadow-sm overflow-hidden h-full">
      {/* Dock Top Tabs */}
      <div className="flex items-center justify-between border-b border-[#1e2a3d] bg-[#0d131f]/80 p-1.5 text-xs font-mono">
        <div className="flex items-center gap-1 w-full">
          <button
            onClick={() => setActiveTab('signal')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'signal'
                ? 'bg-[#1a2436] text-[#4f8ef7] shadow-sm'
                : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>SMC Signal</span>
            {sig && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'manual'
                ? 'bg-[#1a2436] text-[#4f8ef7] shadow-sm'
                : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Order Ticket</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'ai'
                ? 'bg-[#1a2436] text-[#4f8ef7] shadow-sm'
                : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Flow</span>
          </button>
        </div>
      </div>

      {/* Dock Body */}
      <div className="p-3.5 overflow-y-auto flex-1 space-y-3.5 font-mono text-xs">
        {/* TAB 1: SIGNAL & CONFLUENCE */}
        {activeTab === 'signal' && (
          <div className="space-y-3">
            {/* HTF Bias & Structure Card */}
            <div className="bg-[#0b0f17] border border-[#1e2a3d] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-[#6b7a90]">
                <span>Market Structure (H1)</span>
                <span
                  className={`font-bold flex items-center gap-1 ${
                    snapshot.bias === 'bullish'
                      ? 'text-emerald-400'
                      : snapshot.bias === 'bearish'
                      ? 'text-red-400'
                      : 'text-[#94a3b8]'
                  }`}
                >
                  {snapshot.bias === 'bullish' && <TrendingUp className="w-3.5 h-3.5" />}
                  {snapshot.bias === 'bearish' && <TrendingDown className="w-3.5 h-3.5" />}
                  {snapshot.bias.toUpperCase()}
                </span>
              </div>

              {/* Multi-Timeframe Alignment Matrix */}
              <div className="grid grid-cols-4 gap-1 pt-1 border-t border-[#1e2a3d]/70 text-center">
                {snapshot.mtfAlignment?.map((m) => (
                  <div key={m.tf} className="p-1 rounded bg-[#121826] border border-[#1e2a3d]">
                    <div className="text-[10px] text-[#6b7a90] font-bold">{m.tf}</div>
                    <div
                      className={`text-[11px] font-bold ${
                        m.bias === 'bullish'
                          ? 'text-emerald-400'
                          : m.bias === 'bearish'
                          ? 'text-red-400'
                          : 'text-[#94a3b8]'
                      }`}
                    >
                      {m.bias === 'bullish' ? 'BULL' : m.bias === 'bearish' ? 'BEAR' : 'RNG'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-[11px] text-[#94a3b8] pt-1">
                <span>Last BOS: {snapshot.bos ? `${snapshot.bos.price.toFixed(2)}` : '—'}</span>
                <span>Last CHoCH: {snapshot.choch ? `${snapshot.choch.price.toFixed(2)}` : '—'}</span>
              </div>
            </div>

            {/* Dealing Range Slider */}
            {dr && (
              <div className="bg-[#0b0f17] border border-[#1e2a3d] rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#6b7a90] flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-[#4f8ef7]" />
                    <span>Dealing Range Equilibrium</span>
                  </span>
                  <span
                    className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                      isInDiscount
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : isInPremium
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                        : 'bg-[#1a2436] text-[#94a3b8]'
                    }`}
                  >
                    {isInDiscount ? 'DISCOUNT (< 50%)' : isInPremium ? 'PREMIUM (> 50%)' : 'AT EQ'}
                  </span>
                </div>

                <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-500 via-[#334155] to-red-500">
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/70 -translate-x-1/2" />
                  <div
                    className="absolute -top-1 w-3.5 h-4 bg-white rounded shadow -translate-x-1/2"
                    style={{ left: `${posPercent}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-[#6b7a90]">
                  <span>Low: {dr.low.toFixed(1)}</span>
                  <span>EQ: {dr.equilibrium.toFixed(1)}</span>
                  <span>High: {dr.high.toFixed(1)}</span>
                </div>
              </div>
            )}

            {/* Active Signal Setup Box */}
            {sig ? (
              <div className="border border-emerald-500/40 rounded-xl p-3 bg-emerald-950/15 flex flex-col gap-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-base font-bold text-emerald-400">
                    {sig.direction} · SCORE {sig.score} / 5.0
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#1a2436] text-white border border-[#1e2a3d]">
                    ATR {sig.atr}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-[#0b0f17] p-2 rounded-lg border border-[#1e2a3d] text-center">
                  <div>
                    <div className="text-[10px] text-[#6b7a90]">Entry</div>
                    <div className="font-semibold text-white">{sig.entry.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#6b7a90]">Stop Loss</div>
                    <div className="font-semibold text-red-400">{sig.sl.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#6b7a90]">Take Profit</div>
                    <div className="font-semibold text-emerald-400">{sig.tp.toFixed(2)}</div>
                  </div>
                </div>

                {/* Reasons checklist */}
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] uppercase font-bold text-[#6b7a90]">
                    Confluence Breakdown:
                  </div>
                  {sig.reasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-[#dbe4f0]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={onTradeSignal}
                  className="w-full py-2.5 px-3 rounded-lg font-bold transition-all bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-[0.99] flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <Target className="w-4 h-4" />
                  <span>Execute {sig.direction} Signal</span>
                </button>
              </div>
            ) : (
              <div className="bg-[#0b0f17] border border-dashed border-[#1e2a3d] rounded-xl p-5 text-center space-y-2">
                <AlertCircle className="w-5 h-5 text-[#6b7a90] mx-auto" />
                <div className="font-semibold text-[#94a3b8] text-xs">Awaiting Confluence Setup</div>
                <div className="text-[11px] text-[#6b7a90]">
                  SMC engine requires 5.0+ confluence, HTF alignment, a Discount/Premium POI retest, matching candle confirmation, and an active London or New York session.
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANUAL ORDER TICKET */}
        {activeTab === 'manual' && (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[#6b7a90] mb-1">
                <span>Trade Volume (Lots)</span>
                <span className="text-[#94a3b8]">1 Lot = 100 oz</span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="10"
                  value={lot}
                  onChange={(e) => setLot(Math.max(0.01, Number(e.target.value)))}
                  className="flex-1 bg-[#0b0f17] border border-[#1e2a3d] rounded-lg px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#4f8ef7]"
                />
                <div className="flex gap-1">
                  {[0.01, 0.05, 0.1, 0.5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setLot(s)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                        lot === s
                          ? 'bg-[#1a2436] text-[#4f8ef7] border-[#4f8ef7]/40 font-bold'
                          : 'bg-[#0b0f17] text-[#6b7a90] border-[#1e2a3d] hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[#6b7a90] mb-1">Stop Loss (Pips)</div>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={slPips}
                  onChange={(e) => setSlPips(Math.max(0.5, Number(e.target.value)))}
                  className="w-full bg-[#0b0f17] border border-[#1e2a3d] rounded-lg px-2.5 py-1.5 text-white font-semibold focus:outline-none focus:border-[#4f8ef7]"
                />
              </div>
              <div>
                <div className="text-[#6b7a90] mb-1">Risk:Reward</div>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={rr}
                  onChange={(e) => setRr(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-[#0b0f17] border border-[#1e2a3d] rounded-lg px-2.5 py-1.5 text-white font-semibold focus:outline-none focus:border-[#4f8ef7]"
                />
              </div>
            </div>

            <div className="bg-[#0b0f17] border border-[#1e2a3d] rounded-lg p-2.5 flex justify-between text-[11px]">
              <div>
                <span className="text-[#6b7a90]">Risk: </span>
                <span className="text-red-400 font-bold">-${riskDollar.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[#6b7a90]">Reward: </span>
                <span className="text-emerald-400 font-bold">+${rewardDollar.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleManualTrade('BUY')}
                className="py-3 px-3 rounded-lg font-bold font-mono tracking-wider transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 active:scale-[0.98] flex items-center justify-center gap-1"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>BUY @ {snapshot.ask.toFixed(2)}</span>
              </button>
              <button
                onClick={() => handleManualTrade('SELL')}
                className="py-3 px-3 rounded-lg font-bold font-mono tracking-wider transition-all bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 active:scale-[0.98] flex items-center justify-center gap-1"
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>SELL @ {snapshot.bid.toFixed(2)}</span>
              </button>
            </div>

            {ticketMsg && (
              <div
                className={`p-2 rounded text-xs ${
                  ticketMsg.ok
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}
              >
                {ticketMsg.text}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AI ANALYST */}
        {activeTab === 'ai' && <AiAnalyst snapshot={snapshot} />}
      </div>
    </div>
  );
};

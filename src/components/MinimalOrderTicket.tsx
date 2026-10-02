import React, { useState } from 'react';
import { TerminalSnapshot } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import { ArrowUpRight, ArrowDownRight, Check, AlertCircle, ShoppingCart, Percent, DollarSign } from 'lucide-react';

interface MinimalOrderTicketProps {
  snapshot: TerminalSnapshot;
}

export const MinimalOrderTicket: React.FC<MinimalOrderTicketProps> = ({ snapshot }) => {
  const [lot, setLot] = useState<number>(0.05);
  const [slPips, setSlPips] = useState<number>(5.0);
  const [rr, setRr] = useState<number>(2.0);
  const [activeRiskPreset, setActiveRiskPreset] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);

  // In XAUUSD: 1 standard lot (1.00) = 100 oz. 1 pip = $0.10 price move = $10 per pip on 1 lot
  const pipValuePerLot = 10;
  const riskAmount = Number((lot * pipValuePerLot * slPips).toFixed(2));
  const rewardAmount = Number((riskAmount * rr).toFixed(2));

  // Risk % presets calculation based on current account balance
  const applyRiskPctPreset = (pct: number) => {
    setActiveRiskPreset(`${pct}%`);
    const balance = snapshot.balance || 50000;
    const targetRiskDollar = balance * (pct / 100);
    // targetRisk = lot * slPips * 10 => lot = targetRisk / (slPips * 10)
    const calculatedLot = Math.max(0.01, Math.min(10.0, Number((targetRiskDollar / (slPips * 10)).toFixed(2))));
    setLot(calculatedLot);
  };

  // Fixed Dollar risk presets
  const applyFixedDollarPreset = (dollar: number) => {
    setActiveRiskPreset(`$${dollar}`);
    const calculatedLot = Math.max(0.01, Math.min(10.0, Number((dollar / (slPips * 10)).toFixed(2))));
    setLot(calculatedLot);
  };

  const handleLotChange = (val: number) => {
    setLot(val);
    setActiveRiskPreset(null);
  };

  const handleExecute = (direction: 'BUY' | 'SELL') => {
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
      'manual_execution'
    );

    if (res.ok) {
      setFeedback({
        text: `Filled ${direction} ${lot}L @ ${res.price?.toFixed(2)} (SL: ${sl.toFixed(2)}, TP: ${tp.toFixed(2)})`,
        ok: true,
      });
    } else {
      setFeedback({
        text: `Rejected: ${res.error || 'Execution blocked'}`,
        ok: false,
      });
    }

    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  return (
    <div className="bg-white dark:bg-[#111723] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
            Trade Execution Ticket
          </h3>
        </div>
        <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
          Spread: <strong className="text-slate-900 dark:text-slate-200">{snapshot.spread} pts</strong>
        </span>
      </div>

      {/* Lot Size Buttons & Input */}
      <div className="space-y-2 font-mono text-xs">
        <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-medium">
          <span>Position Volume (Lots)</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">1.0 Lot = 100 oz ($10/pip)</span>
        </div>

        {/* Commonly used lot size buttons */}
        <div className="grid grid-cols-6 gap-1.5">
          {[0.01, 0.05, 0.10, 0.25, 0.50, 1.00].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleLotChange(s)}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                lot === s && activeRiskPreset === null
                  ? 'bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Custom Input */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-slate-600 dark:text-slate-400 text-xs">Custom:</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="20"
            value={lot}
            onChange={(e) => handleLotChange(Math.max(0.01, Number(e.target.value)))}
            className="flex-1 bg-slate-50 dark:bg-[#0c1017] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white font-bold text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Risk Presets Row */}
      <div className="space-y-1.5 font-mono text-xs">
        <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-medium">
          <span className="flex items-center gap-1">
            <Percent className="w-3.5 h-3.5 text-amber-500" />
            <span>Fast Risk Presets (Auto-Calculates Lot)</span>
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {[
            { label: '0.5%', fn: () => applyRiskPctPreset(0.5) },
            { label: '1.0%', fn: () => applyRiskPctPreset(1.0) },
            { label: '2.0%', fn: () => applyRiskPctPreset(2.0) },
            { label: '$100', fn: () => applyFixedDollarPreset(100) },
            { label: '$250', fn: () => applyFixedDollarPreset(250) },
            { label: '$500', fn: () => applyFixedDollarPreset(500) },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.fn}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeRiskPreset === item.label
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-amber-500/10 dark:bg-amber-400/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stop Loss & Risk:Reward Grid */}
      <div className="grid grid-cols-2 gap-3 font-mono text-xs">
        <div>
          <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">
            Stop Loss (Pips)
          </label>
          <input
            type="number"
            step="0.5"
            min="1"
            value={slPips}
            onChange={(e) => setSlPips(Math.max(0.5, Number(e.target.value)))}
            className="w-full bg-slate-50 dark:bg-[#0c1017] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-amber-500"
          />
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            {(slPips * 10).toFixed(0)} points distance
          </span>
        </div>

        <div>
          <label className="text-slate-700 dark:text-slate-300 block mb-1 font-semibold">
            Target R:R Ratio
          </label>
          <input
            type="number"
            step="0.5"
            min="1"
            value={rr}
            onChange={(e) => setRr(Math.max(1, Number(e.target.value)))}
            className="w-full bg-slate-50 dark:bg-[#0c1017] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-amber-500"
          />
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            {(slPips * rr).toFixed(1)} pips target
          </span>
        </div>
      </div>

      {/* Real-Time Risk / Reward Dollar Bar */}
      <div className="bg-slate-50 dark:bg-[#0c1017] p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between font-mono text-xs">
        <span className="text-slate-700 dark:text-slate-300 font-medium">
          Risk: <strong className="text-rose-600 dark:text-rose-400 font-bold">-${riskAmount.toFixed(2)}</strong>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">
            ({((riskAmount / snapshot.balance) * 100).toFixed(2)}%)
          </span>
        </span>
        <span className="text-slate-700 dark:text-slate-300 font-medium">
          Reward: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">+${rewardAmount.toFixed(2)}</strong>
        </span>
      </div>

      {/* BUY & SELL Execution Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          onClick={() => handleExecute('BUY')}
          className="py-4 px-4 rounded-xl font-bold font-mono text-sm transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          <ArrowUpRight className="w-5 h-5" />
          <span>BUY ${snapshot.ask.toFixed(2)}</span>
        </button>

        <button
          onClick={() => handleExecute('SELL')}
          className="py-4 px-4 rounded-xl font-bold font-mono text-sm transition-all bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          <ArrowDownRight className="w-5 h-5" />
          <span>SELL ${snapshot.bid.toFixed(2)}</span>
        </button>
      </div>

      {/* Execution Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-xl font-mono text-xs flex items-center gap-2 ${
            feedback.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
          }`}
        >
          {feedback.ok ? (
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}
    </div>
  );
};

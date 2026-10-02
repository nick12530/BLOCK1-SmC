import React, { useState } from 'react';
import { TerminalSnapshot } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import { ShoppingCart, ArrowUpRight, ArrowDownRight, Calculator } from 'lucide-react';

interface OrderTicketProps {
  snapshot: TerminalSnapshot;
}

export const OrderTicket: React.FC<OrderTicketProps> = ({ snapshot }) => {
  const [lot, setLot] = useState<number>(0.05);
  const [slPips, setSlPips] = useState<number>(5.0);
  const [rr, setRr] = useState<number>(2.0);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // In gold (XAUUSD): 1 pip = $0.10, 10 points = 1 pip
  // 1 standard lot (1.00) = $10 per pip
  // Risk in $ = lot * 10 * slPips * 10 ($10 per pip * lot * slPips)
  const pipValuePerLot = 10; // $10 per pip on 1.0 standard lot
  const riskDollar = lot * pipValuePerLot * slPips;
  const rewardDollar = riskDollar * rr;

  const handleTrade = (direction: 'BUY' | 'SELL') => {
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
      'manual_ticket'
    );

    if (res.ok) {
      setMessage({
        text: `FILLED: ${direction} ${lot}L @ ${res.price?.toFixed(2)} | SL: ${sl.toFixed(2)} TP: ${tp.toFixed(2)}`,
        type: 'success',
      });
    } else {
      setMessage({
        text: `REJECTED: ${res.error || 'Failed to submit order'}`,
        type: 'error',
      });
    }

    setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  const handleQuickLot = (size: number) => {
    setLot(size);
  };

  const handleRiskPctLot = (pct: number) => {
    // Risk $ = Balance * (pct / 100)
    // Lot = Risk $ / (slPips * $10)
    const riskMoney = snapshot.balance * (pct / 100);
    const calculatedLot = Math.max(0.01, Math.min(10.0, Number((riskMoney / (slPips * 10)).toFixed(2))));
    setLot(calculatedLot);
  };

  return (
    <div className="bg-[#121826] border border-[#1e2a3d] rounded-xl p-3.5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-[#1e2a3d]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6b7a90] flex items-center gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5 text-[#4f8ef7]" />
          Manual Order Ticket
        </h3>
        <span className="text-[11px] font-mono text-[#6b7a90]">IOC Execution</span>
      </div>

      <div className="space-y-2.5 text-xs font-mono">
        {/* Lot Size Input */}
        <div>
          <div className="flex justify-between text-[#6b7a90] mb-1">
            <span>Volume (Lots)</span>
            <span className="text-[#94a3b8]">1 Lot = 100 oz</span>
          </div>
          <div className="flex gap-1.5">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="20"
              value={lot}
              onChange={(e) => setLot(Math.max(0.01, Number(e.target.value)))}
              className="flex-1 bg-[#0b0f17] border border-[#1e2a3d] rounded-lg px-2.5 py-1.5 text-white font-mono font-semibold focus:outline-none focus:border-[#4f8ef7]"
            />
            <div className="flex gap-1">
              {[0.01, 0.05, 0.1, 0.5].map((s) => (
                <button
                  key={s}
                  onClick={() => handleQuickLot(s)}
                  className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                    lot === s
                      ? 'bg-[#1a2436] text-[#4f8ef7] border-[#4f8ef7]/40'
                      : 'bg-[#0b0f17] text-[#6b7a90] border-[#1e2a3d] hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SL & RR Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[#6b7a90] mb-1">
              <span>SL (Pips)</span>
              <span>{(slPips * 10).toFixed(0)} pts</span>
            </div>
            <input
              type="number"
              step="0.5"
              min="1.0"
              value={slPips}
              onChange={(e) => setSlPips(Math.max(0.5, Number(e.target.value)))}
              className="w-full bg-[#0b0f17] border border-[#1e2a3d] rounded-lg px-2.5 py-1.5 text-white font-mono font-semibold focus:outline-none focus:border-[#4f8ef7]"
            />
          </div>

          <div>
            <div className="flex justify-between text-[#6b7a90] mb-1">
              <span>Risk:Reward</span>
              <span>1 : {rr}</span>
            </div>
            <input
              type="number"
              step="0.5"
              min="1.0"
              value={rr}
              onChange={(e) => setRr(Math.max(1.0, Number(e.target.value)))}
              className="w-full bg-[#0b0f17] border border-[#1e2a3d] rounded-lg px-2.5 py-1.5 text-white font-mono font-semibold focus:outline-none focus:border-[#4f8ef7]"
            />
          </div>
        </div>

        {/* Risk / Reward preview */}
        <div className="bg-[#0b0f17] border border-[#1e2a3d] rounded-lg p-2 flex justify-between items-center text-[11px]">
          <div>
            <span className="text-[#6b7a90]">Risk: </span>
            <span className="text-red-400 font-semibold">-${riskDollar.toFixed(2)}</span>
            <span className="text-[#6b7a90] ml-1">
              ({((riskDollar / snapshot.balance) * 100).toFixed(2)}%)
            </span>
          </div>
          <div className="text-right">
            <span className="text-[#6b7a90]">Reward: </span>
            <span className="text-emerald-400 font-semibold">+${rewardDollar.toFixed(2)}</span>
          </div>
        </div>

        {/* Buy & Sell Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => handleTrade('BUY')}
            className="py-3 px-3 rounded-lg font-bold font-mono tracking-wider transition-all bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>BUY {snapshot.ask.toFixed(2)}</span>
          </button>

          <button
            onClick={() => handleTrade('SELL')}
            className="py-3 px-3 rounded-lg font-bold font-mono tracking-wider transition-all bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>SELL {snapshot.bid.toFixed(2)}</span>
          </button>
        </div>

        {/* Feedback message */}
        {message && (
          <div
            className={`p-2 rounded text-xs font-mono ${
              message.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

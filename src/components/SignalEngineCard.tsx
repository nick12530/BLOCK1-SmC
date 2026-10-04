/**
 * SignalEngineCard.tsx - Precision SMC Signal & Custom Execution Control Center
 * Full User Control & Prominent Trade Entry:
 * - Direction Override: 1-click toggle between BUY, SELL, or Auto-SMC
 * - Dedicated High-Visibility Trade Entry Point display with current spot alignment
 * - Fully customizable Stop Loss (pts / price) and Take Profit (pts / price)
 * - Quick Risk:Reward presets (1:1.5, 1:2.0, 1:3.0, 1:4.0) that auto-calibrate TP
 * - Dynamic dollar risk & profit calculation based on user's exact lot size
 * - Mobile & PC ergonomic layout
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useMarket, useTicker } from '../hooks/useTradingStore';
import { MAX_SPREAD_POINTS, tradingEngine } from '../engine/tradingEngine';
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Copy,
  Check,
  Minus,
  Plus,
  MessageCircle,
  RotateCcw,
  Sliders,
  Target,
  Shield,
  Zap,
} from 'lucide-react';
import { TradeDirection } from '../types/smc';

interface SignalEngineCardProps {
  onExecuteSignal?: (customVolume?: number) => void;
}

export const SignalEngineCard: React.FC<SignalEngineCardProps> = React.memo(({ onExecuteSignal }) => {
  const market = useMarket();
  const ticker = useTicker();

  // User Customizable Controls (No fixed rigidity!)
  const [directionMode, setDirectionMode] = useState<'AUTO' | 'BUY' | 'SELL'>('AUTO');
  const [lotSize, setLotSize] = useState<number>(0.01);
  const [riskPts, setRiskPts] = useState<number>(4.0); // Stop Loss distance in points
  const [rewardPts, setRewardPts] = useState<number>(8.0); // Take Profit distance in points
  const [selectedRR, setSelectedRR] = useState<string>('2.0');
  const [entryOffset, setEntryOffset] = useState<number>(0.0); // Offset from live spot price
  const [copied, setCopied] = useState(false);
  const [executedFeedback, setExecutedFeedback] = useState<string | null>(null);
  const [positionCount, setPositionCount] = useState<number>(1);

  const rawSig = market.signal;
  const isWideSpread = ticker.spread > MAX_SPREAD_POINTS;

  // Active direction based on user choice or algorithmic SMC bias
  const activeDirection: TradeDirection = useMemo(() => {
    if (directionMode === 'BUY') return 'BUY';
    if (directionMode === 'SELL') return 'SELL';
    return rawSig?.direction || (market.bias === 'bearish' ? 'SELL' : 'BUY');
  }, [directionMode, rawSig, market.bias]);

  // Live Entry Price: Spot Price + User Offset
  const currentSpot = activeDirection === 'BUY' ? ticker.ask : ticker.bid;
  const entryPrice = Number((currentSpot + entryOffset).toFixed(2));

  // Calculated SL and TP prices based on user's chosen points
  const slPrice = Number(
    (activeDirection === 'BUY' ? entryPrice - riskPts : entryPrice + riskPts).toFixed(2)
  );
  const tpPrice = Number(
    (activeDirection === 'BUY' ? entryPrice + rewardPts : entryPrice - rewardPts).toFixed(2)
  );

  // Financial Metrics dynamically calculated
  const tradeMetrics = useMemo(() => {
    const dollarPerPoint = lotSize * 100;
    const riskDollar = Number((riskPts * dollarPerPoint).toFixed(2));
    const rewardDollar = Number((rewardPts * dollarPerPoint).toFixed(2));
    const rrRatio = (rewardPts / Math.max(0.1, riskPts)).toFixed(1);

    return {
      riskDollar,
      rewardDollar,
      rrRatio,
    };
  }, [riskPts, rewardPts, lotSize]);

  // When user selects a quick RR preset, update reward points accordingly
  const handleSelectRRPreset = (ratio: number) => {
    setSelectedRR(ratio.toFixed(1));
    const newRewardPts = Number((riskPts * ratio).toFixed(1));
    setRewardPts(newRewardPts);
  };

  // Adjust Risk Points with stepper
  const handleAdjustRiskPts = (delta: number) => {
    setRiskPts((prev) => {
      const next = Math.max(1.5, Math.min(25.0, Number((prev + delta).toFixed(1))));
      // keep RR synced if preset selected
      if (selectedRR !== 'Custom') {
        const ratio = parseFloat(selectedRR);
        setRewardPts(Number((next * ratio).toFixed(1)));
      }
      return next;
    });
  };

  // Adjust Reward Points with stepper
  const handleAdjustRewardPts = (delta: number) => {
    setSelectedRR('Custom');
    setRewardPts((prev) => Math.max(2.0, Math.min(50.0, Number((prev + delta).toFixed(1)))));
  };

  const handleAdjustLot = (delta: number) => {
    setLotSize((prev) => {
      const next = Math.round((prev + delta) * 100) / 100;
      return Math.min(50.0, Math.max(0.01, next));
    });
  };

  const handleResetToSpot = () => {
    setEntryOffset(0.0);
  };

  const handleCopySignal = () => {
    const text = `SMC GOLD: ${activeDirection} XAUUSD @ $${entryPrice.toFixed(2)} | SL: $${slPrice.toFixed(2)} (-${riskPts} pts) | TP: $${tpPrice.toFixed(2)} (+${rewardPts} pts) | 1:${tradeMetrics.rrRatio} RR | Vol: ${lotSize}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToWhatsApp = () => {
    const msg = [
      `🔔 *SMC GOLD BOT — TRADE SETUP*`,
      `━━━━━━━━━━━━━━━━━━━`,
      `📊 *Pair:* XAUUSD (Gold)`,
      `⚡ *Direction:* ${activeDirection === 'BUY' ? '🟢 BUY / LONG' : '🔴 SELL / SHORT'}`,
      `📍 *Entry Point:* $${entryPrice.toFixed(2)}`,
      `🛑 *Stop Loss (SL):* $${slPrice.toFixed(2)} (-$${tradeMetrics.riskDollar} / ${riskPts} pts)`,
      `🏆 *Take Profit (TP):* $${tpPrice.toFixed(2)} (+$${tradeMetrics.rewardDollar} / ${rewardPts} pts)`,
      `⚖️ *Risk/Reward:* 1:${tradeMetrics.rrRatio} RR`,
      `📦 *Lot Volume:* ${lotSize.toFixed(2)}`,
      `━━━━━━━━━━━━━━━━━━━`,
      `_Self-Controlled Institutional Execution_`,
    ].join('\n');

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleExecute = () => {
    if (isWideSpread) return;

    if (positionCount > 1) {
      const res = tradingEngine.tradeMultiplePositions(positionCount, {
        direction: activeDirection,
        volume: lotSize,
        entry: entryPrice,
        sl: slPrice,
        tp: tpPrice,
        comment: `stack_${activeDirection.toLowerCase()}`,
      });
      setExecutedFeedback(`Stacked ${res.countOpened}x ${activeDirection} Orders (${(lotSize * res.countOpened).toFixed(2)} Lots Total)`);
    } else {
      if (onExecuteSignal) {
        onExecuteSignal(lotSize);
      } else {
        tradingEngine.tradeSignal({
          direction: activeDirection,
          volume: lotSize,
          entry: entryPrice,
          sl: slPrice,
          tp: tpPrice,
          comment: `user_${activeDirection.toLowerCase()}`,
        });
      }
      setExecutedFeedback(`Order Sent: ${activeDirection} ${lotSize.toFixed(2)} @ $${entryPrice.toFixed(2)}`);
    }

    setTimeout(() => setExecutedFeedback(null), 3500);
  };

  return (
    <div className="bg-white dark:bg-[#0c0d10] border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] space-y-4 font-mono text-xs sm:text-sm transition-colors">
      <div className="space-y-3.5">
        {/* Top Header: Interactive Direction Switcher & Share */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* USER DIRECTION CONTROLS */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setDirectionMode('BUY')}
              className={`px-3 py-1.5 rounded-lg font-black text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                activeDirection === 'BUY'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>BUY</span>
            </button>

            <button
              onClick={() => setDirectionMode('SELL')}
              className={`px-3 py-1.5 rounded-lg font-black text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                activeDirection === 'SELL'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>SELL</span>
            </button>

            <button
              onClick={() => setDirectionMode('AUTO')}
              className={`px-2 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                directionMode === 'AUTO'
                  ? 'bg-zinc-800 text-amber-400 dark:bg-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="Automatically follow Smart Money bias"
            >
              AUTO
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleSendToWhatsApp}
              title="Send trade setup to WhatsApp"
              className="p-2 rounded-lg text-emerald-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
            </button>

            <button
              onClick={handleCopySignal}
              title="Copy trade parameters"
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PROMINENT HIGH-VISIBILITY TRADE ENTRY SECTION             */}
        {/* ======================================================== */}
        <div className="p-3 sm:p-3.5 rounded-xl border-2 border-cyan-500/50 bg-cyan-500/5 dark:bg-cyan-950/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              <Target className="w-4 h-4" />
              <span>TRADE ENTRY POINT</span>
            </div>
            <span className="text-[11px] text-zinc-500 font-medium">
              Spot: ${currentSpot.toFixed(2)}
            </span>
          </div>

          {/* Large Unmistakable Entry Price Display */}
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-zinc-950 dark:text-white">
                ${entryPrice.toFixed(2)}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  activeDirection === 'BUY'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                }`}
              >
                {activeDirection} @ MARKET
              </span>
            </div>

            {entryOffset !== 0 && (
              <button
                onClick={handleResetToSpot}
                className="flex items-center gap-1 text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer font-bold"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Snap to Spot</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-0.5 border-t border-cyan-500/20">
            <span>
              Distance from Spot: <strong className="text-zinc-800 dark:text-zinc-200">{Math.abs(entryOffset).toFixed(1)} pts</strong>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Instant Fill · 1:1 BE Protected
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CUSTOM STOP LOSS & TAKE PROFIT CONTROLS                  */}
        {/* ======================================================== */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* STOP LOSS CONTROL */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-rose-500 uppercase tracking-wider">STOP LOSS (SL)</span>
              <span className="font-mono text-rose-500/90 font-bold text-xs">-${tradeMetrics.riskDollar}</span>
            </div>

            <span className="font-black text-sm sm:text-base tabular-nums text-rose-600 dark:text-rose-400 block">
              ${slPrice.toFixed(2)}
            </span>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAdjustRiskPts(-0.5)}
                  className="w-7 h-7 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                  title="Tighten Stop Loss by 0.5 pts"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-bold text-xs tabular-nums text-zinc-800 dark:text-zinc-200 w-12 text-center">
                  {riskPts.toFixed(1)} pts
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustRiskPts(0.5)}
                  className="w-7 h-7 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                  title="Widen Stop Loss by 0.5 pts"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* TAKE PROFIT CONTROL */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-500 uppercase tracking-wider">TAKE PROFIT (TP)</span>
              <span className="font-mono text-emerald-500/90 font-bold text-xs">+${tradeMetrics.rewardDollar}</span>
            </div>

            <span className="font-black text-sm sm:text-base tabular-nums text-emerald-600 dark:text-emerald-400 block">
              ${tpPrice.toFixed(2)}
            </span>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAdjustRewardPts(-0.5)}
                  className="w-7 h-7 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                  title="Decrease Target by 0.5 pts"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-bold text-xs tabular-nums text-zinc-800 dark:text-zinc-200 w-12 text-center">
                  {rewardPts.toFixed(1)} pts
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustRewardPts(0.5)}
                  className="w-7 h-7 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                  title="Increase Target by 0.5 pts"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Risk:Reward Presets */}
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[11px] text-zinc-400 font-bold uppercase">RR Presets:</span>
          {[
            { label: '1:1.5 Scalp', ratio: 1.5 },
            { label: '1:2.0 SMC', ratio: 2.0 },
            { label: '1:3.0 Runner', ratio: 3.0 },
            { label: '1:4.0 Swing', ratio: 4.0 },
          ].map((item) => (
            <button
              key={item.ratio}
              type="button"
              onClick={() => handleSelectRRPreset(item.ratio)}
              className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer border ${
                selectedRR === item.ratio.toFixed(1)
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-900 dark:border-white'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              1:{item.ratio.toFixed(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* LOT SIZE SELECTOR & 1-CLICK EXECUTE BUTTON                */}
      {/* ======================================================== */}
      <div className="space-y-3 pt-1">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-0.5">
            <span className="text-zinc-500 dark:text-zinc-400 font-bold">Trade Volume (Lots):</span>
            <span className="text-emerald-500 font-bold">
              1:{tradeMetrics.rrRatio} RR · Micro 0.01 Recommended
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAdjustLot(-0.01)}
              className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-800 cursor-pointer min-w-[38px] flex items-center justify-center"
              title="Decrease lot size"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="relative flex-1">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="50.0"
                value={lotSize}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) setLotSize(val);
                }}
                className="w-full text-center font-black text-sm sm:text-base bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg py-2 text-zinc-950 dark:text-white outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="button"
              onClick={() => handleAdjustLot(0.01)}
              className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-800 cursor-pointer min-w-[38px] flex items-center justify-center"
              title="Increase lot size"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 justify-between pt-0.5">
            {[0.01, 0.02, 0.03, 0.05, 0.1].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLotSize(preset)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  lotSize === preset
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Position Stacking Controls */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
            <span className="text-zinc-500 dark:text-zinc-400 font-bold">Positions to Stack:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 5].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setPositionCount(cnt)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer border ${
                    positionCount === cnt
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-black border-zinc-950 dark:border-white shadow-xs'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {cnt}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {executedFeedback && (
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold text-center border border-emerald-300 dark:border-emerald-800">
            ✓ {executedFeedback}
          </div>
        )}

        {/* 1-Click Execution Button */}
        <button
          onClick={handleExecute}
          disabled={isWideSpread}
          className={`w-full py-3.5 sm:py-4 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-colors flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer ${
            isWideSpread
              ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500 cursor-not-allowed border border-zinc-300 dark:border-zinc-800'
              : activeDirection === 'SELL'
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
          }`}
        >
          <span>
            {isWideSpread
              ? `SPREAD TOO WIDE (${ticker.spread} PTS)`
              : positionCount > 1
              ? `EXECUTE SIGNAL · STACK ${positionCount}X ${activeDirection} ORDERS (${(lotSize * positionCount).toFixed(2)} LOTS TOTAL)`
              : `EXECUTE SIGNAL · ${activeDirection} ${lotSize.toFixed(2)} LOTS @ $${entryPrice.toFixed(2)}`}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

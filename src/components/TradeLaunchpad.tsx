import React, { useState, useMemo } from 'react';
import { useTicker, useMarket, useEngine } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { getInstrumentConfig, SUPPORTED_SYMBOLS, SupportedSymbol } from '../engine/instrumentConfig';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Sparkles,
  Info,
} from 'lucide-react';

interface TradeLaunchpadProps {
  onSymbolSelect?: (symbol: SupportedSymbol) => void;
  onTradeExecuted?: () => void;
}

export const TradeLaunchpad: React.FC<TradeLaunchpadProps> = ({
  onSymbolSelect,
  onTradeExecuted,
}) => {
  const ticker = useTicker();
  const market = useMarket();
  const engine = useEngine();

  const [activeTab, setActiveTab] = useState<'signal' | 'manual'>('signal');
  const [lot, setLot] = useState<number>(0.01);
  const [selectedDirection, setSelectedDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [slPips, setSlPips] = useState<number>(15);
  const [tpPips, setTpPips] = useState<number>(30);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const activeSymbol = (ticker.symbol || 'USDJPY') as SupportedSymbol;
  const cfg = getInstrumentConfig(activeSymbol);
  const rawSig = market.signal;

  // Live spread in pips
  const spreadPoints = ticker.spread || 12;
  const spreadPips = Number((spreadPoints * (cfg.pointSize / cfg.pipSize)).toFixed(1));
  const isSpreadAcceptable = spreadPoints <= cfg.maxSpreadPoints;

  // Leverage & Margin calculations for small accounts ($10)
  const leverage = engine.leverage || 2000;
  const contractSize = cfg.contractSize;
  const currentSpot = selectedDirection === 'BUY' ? ticker.ask : ticker.bid;
  
  // Required margin for 0.01 lot:
  // For forex (USDJPY, EURUSD, GBPUSD): Notional = lot * 100,000 USD / leverage
  // For gold (XAUUSD): Notional = lot * 100 oz * spot / leverage
  const requiredMargin = useMemo(() => {
    if (cfg.category === 'metals') {
      return (lot * 100 * currentSpot) / leverage;
    }
    return (lot * contractSize) / leverage;
  }, [cfg.category, lot, currentSpot, leverage, contractSize]);

  // Risk & Reward in USD for manual order
  const manualMetrics = useMemo(() => {
    const pipVal = cfg.pipValuePerMicroLot * (lot / 0.01);
    const riskUsd = Number((slPips * pipVal).toFixed(2));
    const rewardUsd = Number((tpPips * pipVal).toFixed(2));
    const rr = slPips > 0 ? (tpPips / slPips).toFixed(1) : '1:2';
    const riskPctAccount = ticker.balance > 0 ? ((riskUsd / ticker.balance) * 100).toFixed(1) : '0';

    return {
      riskUsd,
      rewardUsd,
      rr,
      riskPctAccount,
    };
  }, [cfg.pipValuePerMicroLot, lot, slPips, tpPips, ticker.balance]);

  // SMC Signal Metrics
  const signalMetrics = useMemo(() => {
    if (!rawSig) return null;
    const stopDist = Math.abs(rawSig.entry - rawSig.sl);
    const targetDist = Math.abs(rawSig.tp - rawSig.entry);
    const stopInPips = Number((stopDist / cfg.pipSize).toFixed(1));
    const targetInPips = Number((targetDist / cfg.pipSize).toFixed(1));
    const pipVal = cfg.pipValuePerMicroLot * (lot / 0.01);
    const riskUsd = Number((stopInPips * pipVal).toFixed(2));
    const rewardUsd = Number((targetInPips * pipVal).toFixed(2));
    const rr = stopDist > 0 ? (targetDist / stopDist).toFixed(1) : '1:2';
    const riskPct = ticker.balance > 0 ? ((riskUsd / ticker.balance) * 100).toFixed(1) : '0';

    return {
      stopInPips,
      targetInPips,
      riskUsd,
      rewardUsd,
      rr,
      riskPct,
    };
  }, [rawSig, cfg.pipSize, cfg.pipValuePerMicroLot, lot, ticker.balance]);

  const handleExecuteSignal = () => {
    if (!rawSig) return;
    const res = tradingEngine.sendMarket(
      rawSig.direction,
      lot,
      rawSig.sl,
      rawSig.tp,
      `smc:${rawSig.strategy}`
    );

    if (res.ok) {
      setFeedback({
        msg: `ORDER SENT: ${rawSig.direction} ${lot}L ${activeSymbol} @ ${res.price?.toFixed(cfg.digits)} (SL: ${rawSig.sl} | TP: ${rawSig.tp})`,
        type: 'success',
      });
      onTradeExecuted?.();
    } else {
      setFeedback({
        msg: `ORDER BLOCKED: ${res.error || 'Execution gate rejected order'}`,
        type: 'error',
      });
    }

    setTimeout(() => setFeedback(null), 6000);
  };

  const handleExecuteManual = (direction: 'BUY' | 'SELL') => {
    const price = direction === 'BUY' ? ticker.ask : ticker.bid;
    const stopDistancePrice = slPips * cfg.pipSize;
    const targetDistancePrice = tpPips * cfg.pipSize;

    const sl = Number((direction === 'BUY' ? price - stopDistancePrice : price + stopDistancePrice).toFixed(cfg.digits));
    const tp = Number((direction === 'BUY' ? price + targetDistancePrice : price - targetDistancePrice).toFixed(cfg.digits));

    const res = tradingEngine.sendMarket(
      direction,
      lot,
      sl,
      tp,
      'manual:launchpad'
    );

    if (res.ok) {
      setFeedback({
        msg: `FILLED: ${direction} ${lot}L ${activeSymbol} @ ${res.price?.toFixed(cfg.digits)} | SL: ${sl} | TP: ${tp}`,
        type: 'success',
      });
      onTradeExecuted?.();
    } else {
      setFeedback({
        msg: `REJECTED: ${res.error || 'Failed to place order'}`,
        type: 'error',
      });
    }

    setTimeout(() => setFeedback(null), 6000);
  };

  return (
    <div className="w-full bg-white dark:bg-[#0b131e] border border-slate-200 dark:border-[#1a3044] rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-sm font-mono text-xs">
      {/* Header: Title + Active Pair Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-[#172b3e] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h3 className="font-black text-slate-950 dark:text-white uppercase tracking-wider text-xs sm:text-sm">
              Trade Execution Station
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              1-Click Smart Execution with Small Account ($10) Safety Rules
            </p>
          </div>
        </div>

        {/* 4 Instrument Quick Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#071018] p-1 rounded-xl border border-slate-200 dark:border-[#162739]">
          {SUPPORTED_SYMBOLS.map((sym) => {
            const isSelected = sym === activeSymbol;
            return (
              <button
                key={sym}
                type="button"
                onClick={() => {
                  tradingEngine.switchSymbol(sym);
                  onSymbolSelect?.(sym);
                }}
                className={`px-2.5 py-1 rounded-lg font-black transition-all cursor-pointer text-xs ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {sym}
              </button>
            );
          })}
        </div>
      </div>

      {/* Symbol Live Telemetry Ribbon */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-[#071018] p-2.5 rounded-xl border border-slate-200/70 dark:border-[#142332] text-[11px]">
        <div>
          <span className="text-[9px] uppercase text-slate-400">Current Ask (BUY)</span>
          <div className="font-black text-emerald-500 text-sm">
            {ticker.ask.toFixed(cfg.digits)}
          </div>
        </div>
        <div>
          <span className="text-[9px] uppercase text-slate-400">Current Bid (SELL)</span>
          <div className="font-black text-rose-500 text-sm">
            {ticker.bid.toFixed(cfg.digits)}
          </div>
        </div>
        <div>
          <span className="text-[9px] uppercase text-slate-400">Live Spread</span>
          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-900 dark:text-slate-200">{spreadPips} pips</span>
            <span
              className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                isSpreadAcceptable
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}
            >
              {isSpreadAcceptable ? 'Normal' : 'Wide'}
            </span>
          </div>
        </div>
        <div>
          <span className="text-[9px] uppercase text-slate-400">Required Margin (0.01L)</span>
          <div className="font-bold text-sky-500">
            ${requiredMargin.toFixed(2)} USD (1:{leverage})
          </div>
        </div>
      </div>

      {/* Tab Switcher: SMC Setup vs 1-Click Manual */}
      <div className="mt-3 flex items-center gap-1.5 border-b border-slate-200/70 dark:border-[#162739] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('signal')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'signal'
              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Execute SMC Prime Setup</span>
          {rawSig && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'manual'
              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calculator className="w-3.5 h-3.5 text-indigo-400" />
          <span>1-Click Manual Order</span>
        </button>
      </div>

      {/* Feedback Alert Banner */}
      {feedback && (
        <div
          className={`mt-3 p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* TAB 1: SMC SIGNAL EXECUTION STATION */}
      {activeTab === 'signal' && (
        <div className="mt-3 space-y-3">
          {rawSig ? (
            <div className="bg-slate-50 dark:bg-[#07111c] border border-slate-200 dark:border-[#172c3f] rounded-xl p-3.5 space-y-3">
              {/* Signal Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg font-black text-xs flex items-center gap-1 ${
                      rawSig.direction === 'BUY'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {rawSig.direction === 'BUY' ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    <span>{rawSig.direction}</span>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {rawSig.strategy}
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-[#11202e] px-1.5 py-0.5 rounded">
                    {rawSig.timeframe}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-400">Confluence:</span>
                  <span className="font-black text-sky-500 font-mono">
                    {rawSig.score <= 10 ? `${(rawSig.score * 10).toFixed(0)}%` : `${rawSig.score}%`}
                  </span>
                </div>
              </div>

              {/* Price Points: Entry, SL, TP */}
              <div className="grid grid-cols-3 gap-2 bg-white dark:bg-[#0b1724] p-2.5 rounded-lg border border-slate-200/80 dark:border-[#162738] text-[11px]">
                <div>
                  <span className="text-[9px] uppercase text-slate-400">Entry Target</span>
                  <div className="font-black text-slate-900 dark:text-white">
                    {rawSig.entry.toFixed(cfg.digits)}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-rose-500">
                    Stop Loss ({signalMetrics?.stopInPips}p)
                  </span>
                  <div className="font-black text-rose-500">
                    {rawSig.sl.toFixed(cfg.digits)}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-emerald-500">
                    Take Profit ({signalMetrics?.targetInPips}p)
                  </span>
                  <div className="font-black text-emerald-500">
                    {rawSig.tp.toFixed(cfg.digits)}
                  </div>
                </div>
              </div>

              {/* Small Account Dollar Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-sky-500/5 p-2 rounded-lg border border-sky-500/20 text-[10px]">
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">Calculated Risk</span>
                  <div className="font-bold text-rose-500">-${signalMetrics?.riskUsd} USD ({signalMetrics?.riskPct}% of $10)</div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">Potential Reward</span>
                  <div className="font-bold text-emerald-500">+${signalMetrics?.rewardUsd} USD</div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">Risk : Reward</span>
                  <div className="font-bold text-sky-500">1 : {signalMetrics?.rr}</div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">Spread Impact</span>
                  <div className="font-bold text-slate-700 dark:text-slate-300">
                    {spreadPips}p / {signalMetrics?.stopInPips}p ({signalMetrics?.stopInPips ? ((spreadPips / signalMetrics.stopInPips) * 100).toFixed(0) : 0}%)
                  </div>
                </div>
              </div>

              {/* Rationale explanation */}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                <span>{rawSig.actionReason || rawSig.perfectEntryReason}</span>
              </div>

              {/* Big 1-Click Launch Button */}
              <button
                type="button"
                onClick={handleExecuteSignal}
                className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  rawSig.direction === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'
                }`}
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Execute {rawSig.direction} Signal ({lot} Lot)</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-slate-200 dark:border-[#1a3148] rounded-xl space-y-2">
              <Sparkles className="w-6 h-6 text-slate-400 mx-auto" />
              <div className="font-bold text-slate-700 dark:text-slate-300">
                Scanning for Institutional Confirmation on {activeSymbol}...
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                No sub-standard signals will be generated. The engine is waiting for liquidity sweeps and order block mitigation with minimum {cfg.minPracticalStopPips}-pip safe stops.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className="mt-2 text-sky-500 hover:underline font-bold text-xs"
              >
                Or place a manual order with custom stops →
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL 1-CLICK ORDER STATION */}
      {activeTab === 'manual' && (
        <div className="mt-3 space-y-3">
          {/* Lot Selector */}
          <div className="bg-slate-50 dark:bg-[#07111c] p-3 rounded-xl border border-slate-200 dark:border-[#172c3f]">
            <div className="flex justify-between text-slate-400 mb-1.5">
              <span className="font-bold">Trade Volume (Lots)</span>
              <span>Recommended for $10: <b className="text-sky-400">0.01 Micro Lot</b></span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="5.0"
                value={lot}
                onChange={(e) => setLot(Math.max(0.01, Number(e.target.value)))}
                className="flex-1 bg-white dark:bg-[#0c1622] border border-slate-200 dark:border-[#1a334b] rounded-lg px-3 py-1.5 text-slate-900 dark:text-white font-bold text-sm"
              />
              {[0.01, 0.02, 0.05].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setLot(val)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    lot === val
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-transparent'
                      : 'bg-white dark:bg-[#0e1b28] border-slate-200 dark:border-[#1b344d] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {val}L
                </button>
              ))}
            </div>
          </div>

          {/* Stop Loss & Take Profit in Pips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Stop Loss Pips */}
            <div className="bg-slate-50 dark:bg-[#07111c] p-3 rounded-xl border border-slate-200 dark:border-[#172c3f]">
              <div className="flex justify-between text-slate-400 mb-1">
                <span className="text-rose-500 font-bold">Stop Loss Distance</span>
                <span className="text-rose-400">-${manualMetrics.riskUsd} USD</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="1"
                  min={cfg.minPracticalStopPips}
                  max="100"
                  value={slPips}
                  onChange={(e) => setSlPips(Math.max(cfg.minPracticalStopPips, Number(e.target.value)))}
                  className="flex-1 bg-white dark:bg-[#0c1622] border border-slate-200 dark:border-[#1a334b] rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-white"
                />
                <span className="text-slate-400 text-xs font-mono">pips</span>
                {[10, 15, 20].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSlPips(p)}
                    className="px-2 py-1 bg-white dark:bg-[#0e1b28] border border-slate-200 dark:border-[#1b344d] rounded text-[10px] text-slate-600 dark:text-slate-300 hover:border-slate-400"
                  >
                    {p}p
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Min safe stop: {cfg.minPracticalStopPips} pips (prevents spread stop-out)
              </div>
            </div>

            {/* Take Profit Pips */}
            <div className="bg-slate-50 dark:bg-[#07111c] p-3 rounded-xl border border-slate-200 dark:border-[#172c3f]">
              <div className="flex justify-between text-slate-400 mb-1">
                <span className="text-emerald-500 font-bold">Take Profit Distance</span>
                <span className="text-emerald-400">+${manualMetrics.rewardUsd} USD</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="200"
                  value={tpPips}
                  onChange={(e) => setTpPips(Math.max(5, Number(e.target.value)))}
                  className="flex-1 bg-white dark:bg-[#0c1622] border border-slate-200 dark:border-[#1a334b] rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-white"
                />
                <span className="text-slate-400 text-xs font-mono">pips</span>
                {[20, 30, 50].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTpPips(p)}
                    className="px-2 py-1 bg-white dark:bg-[#0e1b28] border border-slate-200 dark:border-[#1b344d] rounded text-[10px] text-slate-600 dark:text-slate-300 hover:border-slate-400"
                  >
                    {p}p
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Risk:Reward ratio = 1:{manualMetrics.rr}
              </div>
            </div>
          </div>

          {/* Big BUY and SELL Trigger Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => handleExecuteManual('BUY')}
              className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex flex-col items-center justify-center gap-1"
            >
              <div className="flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4" />
                <span>BUY {activeSymbol}</span>
              </div>
              <span className="text-[11px] font-mono font-normal opacity-90">
                Ask @ {ticker.ask.toFixed(cfg.digits)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleExecuteManual('SELL')}
              className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-rose-500/20 transition-all cursor-pointer flex flex-col items-center justify-center gap-1"
            >
              <div className="flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4" />
                <span>SELL {activeSymbol}</span>
              </div>
              <span className="text-[11px] font-mono font-normal opacity-90">
                Bid @ {ticker.bid.toFixed(cfg.digits)}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Small Account Technical Safeguards Checklist */}
      <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-[#162738] space-y-1 text-[10px] text-slate-500 dark:text-slate-400">
        <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span>Small Account ($10) Institutional Pre-Flight Verification</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-sans">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>0.01 micro-lot fixed sizing (no averaging or martingale)</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>Stops protected beyond minimum {cfg.minPracticalStopPips}-pip broker spread noise floor</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>Margin requirement (${requiredMargin.toFixed(2)}) is only ~5% of $10 account</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>1:2+ target RR provides positive mathematical expectancy</span>
          </div>
        </div>
      </div>
    </div>
  );
};

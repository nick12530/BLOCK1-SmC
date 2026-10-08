/**
 * SignalToastNotification.tsx - High-Impact SMC Signal Alert Beacon & Stacking Popover
 * Configured specifically for high-impact setups:
 * - Macro news shifts, liquidity sweeps, and high-profit multiplier expansions (1:3+ RR)
 * - Position Stacking: allows traders to open multiple identical positions (1x, 2x, 3x, 5x) simultaneously
 * - Elite monochromatic grey, white, and black dark mode design
 */

import React, { useState, useEffect, useRef } from 'react';
import { signalAudioNotifier } from '../utils/audioNotification';
import { useMarket, useTicker, usePositions } from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { RISK_CONFIG } from '../engine/riskConfig';
import { mt5Bridge } from '../engine/mt5Bridge';
import {
  buildSignalRationale,
  findCorrespondingOrderBlock,
} from '../engine/tradeJournal';
import {
  TrendingUp,
  TrendingDown,
  X,
  Zap,
  Minus,
  Plus,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export const SignalToastNotification: React.FC = () => {
  const market = useMarket();
  const ticker = useTicker();
  const positionsState = usePositions();

  const [isOpen, setIsOpen] = useState(false);
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const [lotSize, setLotSize] = useState(0.01);
  const [stackCount, setStackCount] = useState<number>(1);
  const [executedCount, setExecutedCount] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const signal = market.signal;
  const activeDirection = signal?.direction || (market.bias === 'bearish' ? 'SELL' : 'BUY');
  const activeEntry = signal?.entry ?? ticker.bid;
  const isBuy = activeDirection === 'BUY';

  const activeSL = signal?.sl ?? activeEntry;
  const activeTP = signal?.tp ?? activeEntry;
  const riskPts = Math.abs(activeEntry - activeSL);
  const rewardPts = Math.abs(activeTP - activeEntry);
  const strengthScore = signal?.score ?? 0;
  const riskLimitedLotSize = signal ? tradingEngine.getRiskBasedVolume(signal.sl, lotSize) ?? 0 : 0;

  // Listen to engine signal chime alerts
  useEffect(() => {
    const unsubscribe = signalAudioNotifier.onSignalAlert(() => {
      setHasNewAlert(true);
      const timer = setTimeout(() => {
        setHasNewAlert(false);
      }, 9000);
      return () => clearTimeout(timer);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!signal) setIsOpen(false);
  }, [signal]);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleExecute = async () => {
    if (!signal || stackCount !== 1 || positionsState.positions.length >= RISK_CONFIG.maxOpenPositions) return;
    const gateReason = tradingEngine.getEntryBlockReason(signal.direction, signal);
    if (gateReason) {
      tradingEngine.slog(`Signal alert order blocked: ${gateReason}`, 'error');
      return;
    }
    if (!riskLimitedLotSize) {
      tradingEngine.slog('Signal alert order blocked: risk-based size is invalid for broker volume/tick-value specifications.', 'error');
      return;
    }
    if (tradingEngine.mt5Account.connected && !mt5Bridge.getStatus().connected) {
      tradingEngine.slog('Signal alert order blocked: MT5 bridge is offline.', 'error');
      return;
    }

    if (mt5Bridge.getStatus().connected) {
      let opened = 0;
      const rationale = buildSignalRationale(signal);
      const strategyOrderBlock = findCorrespondingOrderBlock(
        signal.direction,
        signal.entry,
        tradingEngine.getMarketSnapshot().zones
      );
      for (let index = 0; index < stackCount; index += 1) {
        try {
          const result = await mt5Bridge.sendTrade({
            direction: signal.direction,
            volume: riskLimitedLotSize,
            symbol: mt5Bridge.getSymbol(),
            sl: signal.sl,
            tp: signal.tp,
            rationale,
            clientOrderId: `${signal.strategy}:${signal.timeframe}:${signal.direction}:${signal.timestamp}:${signal.entry.toFixed(8)}`,
            poiKey: tradingEngine.getSignalPoiKey(signal.direction, signal.entry),
            instrumentType: tradingEngine.instrumentType,
            signalTimeframe: signal.timeframe === 'M1' ? 'M1' : 'M5',
            signalTimestamp: signal.timestamp,
          });
          tradingEngine.recordMt5Rationale(
            result.ticket,
            result.positionTicket,
            rationale,
            strategyOrderBlock
          );
          tradingEngine.recordAcceptedEntry(signal.direction, signal);
          opened += 1;
        } catch (error) {
          tradingEngine.slog(
            `Signal alert order ${index + 1} rejected: ${error instanceof Error ? error.message : 'Unknown bridge error'}`,
            'error'
          );
          break;
        }
      }
      setExecutedCount(opened);
    } else {
      const result = tradingEngine.tradeMultiplePositions(stackCount, {
        direction: signal.direction,
        volume: riskLimitedLotSize,
        entry: signal.entry,
        sl: signal.sl,
        tp: signal.tp,
        comment: `signal_alert_${stackCount}x`,
      });
      setExecutedCount(result.countOpened);
    }

    setTimeout(() => {
      setExecutedCount(null);
      setIsOpen(false);
      setHasNewAlert(false);
    }, 2500);
  };

  const handleAdjustLot = (delta: number) => {
    setLotSize((prev) => {
      const next = Math.round((prev + delta) * 100) / 100;
      return Math.min(5.0, Math.max(0.01, next));
    });
  };

  const totalExposureLots = Number((riskLimitedLotSize * stackCount).toFixed(2));
  const potentialProfitDollars = (rewardPts * 100 * totalExposureLots).toFixed(2);
  const potentialRiskDollars = (riskPts * 100 * totalExposureLots).toFixed(2);

  if (!signal) return null;

  return (
    <>
      {/* HIGH-IMPACT SIGNAL FLYOUT CARD */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-20 sm:right-6 z-[160] font-mono select-none flex items-end sm:items-center justify-center p-3 sm:p-0 bg-black/70 sm:bg-transparent backdrop-blur-xs sm:backdrop-blur-none animate-in fade-in duration-150">
          <div
            ref={popoverRef}
            className="w-full max-w-sm sm:w-96 rounded-2xl bg-[#0c0d10] text-zinc-100 border border-zinc-700/90 shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-4 sm:p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
          >
            {/* Header: High Impact Tag & Close */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white">
                  <Zap className="w-3.5 h-3.5 text-zinc-200" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                      SMC SETUP ALERT
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                      Score {strengthScore}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-sm text-white">
                    {activeDirection} {mt5Bridge.getSymbol()} · {signal.timeframe} setup
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* High Impact Trade Rationale & Profit Multiplier */}
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Target if reached:</span>
                <strong className="text-white font-black tabular-nums">
                  +${potentialProfitDollars} USD ({(rewardPts / Math.max(riskPts, 0.01)).toFixed(1)}R)
                </strong>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Max Defined Risk:</span>
                <span className="text-zinc-400 font-bold tabular-nums">
                  -${potentialRiskDollars} USD
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans border-t border-zinc-800 pt-1.5 leading-relaxed">
                Filtered setup only. Price can move against this trade; the target and stop are not a profit guarantee.
              </p>
            </div>

            {/* Price Levels Grid */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-bold">
                  Entry
                </span>
                <span className="font-black text-white tabular-nums block text-xs sm:text-sm mt-0.5">
                  ${activeEntry.toFixed(2)}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-bold">
                  Stop Loss
                </span>
                <span className="font-black text-zinc-300 tabular-nums block text-xs sm:text-sm mt-0.5">
                  ${activeSL.toFixed(2)}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-bold">
                  Take Profit
                </span>
                <span className="font-black text-zinc-100 tabular-nums block text-xs sm:text-sm mt-0.5">
                  ${activeTP.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Position Stacking Selector (Open Multiple Identical Trades) */}
            <div className="space-y-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Position Count (one entry per signal):</span>
                </span>
                <span className="text-[11px] font-mono text-zinc-400 font-bold">
                  {stackCount}x ({totalExposureLots} Lots Total)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 font-mono text-xs">
                {[{ label: '1x Single', val: 1 }].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setStackCount(item.val)}
                    className={`py-1.5 px-1 rounded-lg font-bold text-[11px] border transition-colors cursor-pointer text-center ${
                      stackCount === item.val
                        ? 'bg-white text-black border-white shadow-xs'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white hover:border-zinc-500'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lot Size Steppers per position */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
              <span className="text-zinc-400 font-bold">
                Lot Size per Trade:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAdjustLot(-0.01)}
                  className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-black text-xs text-white tabular-nums w-12 text-center">
                  {lotSize.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustLot(0.01)}
                  className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Execution & Dismiss Action Row */}
            {executedCount !== null ? (
              <div className="w-full py-3 rounded-xl bg-white text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{executedCount > 0 ? `MT5 / SIMULATION ACCEPTED ${executedCount}X` : 'NO ORDERS ACCEPTED'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3.5 py-3 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  title="Close alert"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleExecute}
                  className="flex-1 py-3 sm:py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer bg-white text-black hover:bg-zinc-200 active:scale-[0.99] shadow-xs"
                >
                  <Zap className="w-4 h-4 fill-black" />
                  <span>
                    {stackCount > 1
                      ? `STACK ${stackCount}X ${activeDirection} (${totalExposureLots}L)`
                      : `EXECUTE ${activeDirection} (${lotSize.toFixed(2)}L)`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FLOATING HIGH-IMPACT SIGNAL TRIGGER BUTTON */}
      <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-[150] select-none font-mono">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          title={`${activeDirection} SMC setup · Inspect signal levels`}
          className="relative flex items-center gap-2 px-3 py-2 rounded-full bg-[#0c0d10] border border-zinc-700 text-white shadow-xl hover:border-zinc-500 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>

          <span className="font-extrabold text-[11px] uppercase tracking-wider text-zinc-200">
            {activeDirection} Setup
          </span>

          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
            {strengthScore}
          </span>
        </button>
      </div>
    </>
  );
};

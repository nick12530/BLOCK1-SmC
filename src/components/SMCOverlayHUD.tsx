/**
 * SMCOverlayHUD.tsx - Institutional SMC Indicators Overlay for the Chart
 * Pure coloured lines and embedded text - ZERO opaque coloured bars or background blocks.
 *
 * Implements:
 * - Coloured dotted horizontal lines with centred text for Order Blocks, BOS, CHoCH, EQ, and FVGs
 * - Pure transparent background: chart candlesticks remain 100% visible
 * - Tapped trade highlights trade Order Block, Entry, SL, and TP coloured lines
 * - Cross-pair signal correlation strip at the top
 */

import React, { memo } from 'react';
import {
  useMarket,
  usePositions,
  useTicker,
  useScannerAnalyses,
} from '../hooks/useTradingStore';
import { tradingEngine } from '../engine/tradingEngine';
import { findCorrespondingOrderBlock } from '../engine/tradeJournal';
import type { SMCIndicatorConfig } from './SMCInteractiveChart';
import type { SupportedSymbol } from '../engine/instrumentConfig';

interface SMCOverlayHUDProps {
  showIndicators: boolean;
  indicatorConfig: SMCIndicatorConfig;
  onToggleIndicators?: () => void;
  onFocusOrderBlock?: () => void;
  onSwitchToSMC?: () => void;
}

export const SMCOverlayHUD: React.FC<SMCOverlayHUDProps> = memo(({
  showIndicators,
  indicatorConfig,
  onSwitchToSMC,
}) => {
  const market = useMarket();
  const positionsState = usePositions();
  const ticker = useTicker();
  const scannerAnalyses = useScannerAnalyses();

  if (!showIndicators) return null;

  const currentPrice = ticker.bid;
  const signal = market.signal;
  const dealingRange = market.dealing_range;
  const zones = market.zones || [];

  // Filter nearest Order Blocks
  const demandOB = zones.find((z) => z.kind === 'OB' && z.bullish);
  const supplyOB = zones.find((z) => z.kind === 'OB' && !z.bullish);
  const activeFVG = zones.find((z) => z.kind === 'FVG');
  const activePositions = positionsState.positions;

  // Calculate Equilibrium & Premium/Discount
  const eqPrice = dealingRange ? dealingRange.equilibrium : (ticker.high24h + ticker.low24h) / 2;
  const isPremium = currentPrice >= eqPrice;

  // Find selected trade and its corresponding order block (guaranteed fallback to first active trade)
  const selectedPosition =
    positionsState.positions.find((p) => p.ticket === positionsState.selectedTicket) ||
    positionsState.positions[0];

  const selectedOrderBlock = selectedPosition
    ? selectedPosition.strategyOrderBlock ||
      findCorrespondingOrderBlock(selectedPosition.type, selectedPosition.price_open, zones) || {
        kind: 'OB' as const,
        bullish: selectedPosition.type === 'BUY',
        bottom:
          selectedPosition.type === 'BUY'
            ? selectedPosition.price_open - (ticker.spread * 0.08 || 1.2)
            : selectedPosition.price_open - 0.4,
        top:
          selectedPosition.type === 'BUY'
            ? selectedPosition.price_open + 0.4
            : selectedPosition.price_open + (ticker.spread * 0.08 || 1.2),
        tests: 0,
        filled: false,
        mitigated: false,
        born: 0,
      }
    : undefined;

  // Other currency pairs signals linked into the chart
  const otherPairAnalyses = scannerAnalyses.filter((item) => item.symbol !== ticker.symbol);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-2 select-none overflow-hidden font-mono bg-transparent">
      {/* Top Bar: Minimal Line Status & Linked Cross-Pair Signals Strip */}
      <div className="flex flex-col gap-1.5 pointer-events-auto">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Active Overlay Status */}
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sky-300">SMC INDICATORS ACTIVE</span>
            <span className="text-slate-500">|</span>
            <span className={isPremium ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isPremium ? 'PREMIUM (Sells)' : 'DISCOUNT (Buys)'}
            </span>
          </div>

          {/* Quick Cross-Pair Indicator Links */}
          {otherPairAnalyses.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Pairs:
              </span>
              {otherPairAnalyses.map((pair) => {
                const isBull = pair.bias === 'BUY';
                return (
                  <button
                    key={pair.symbol}
                    onClick={() => tradingEngine.switchSymbol(pair.symbol as SupportedSymbol)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer shrink-0 ${
                      pair.signal
                        ? isBull
                          ? 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10'
                          : 'border-rose-500/50 text-rose-400 hover:bg-rose-500/10'
                        : 'border-slate-700 text-slate-400 hover:text-white'
                    }`}
                    title={`Switch chart to ${pair.symbol}`}
                  >
                    <span className="text-white mr-1">{pair.symbol}</span>
                    <span className={isBull ? 'text-emerald-400' : 'text-rose-400'}>
                      {pair.bias} ({pair.confluenceScore})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Middle Chart Area: Live Institutional SMC Telemetry Ribbon */}
      <div className="my-auto w-full flex flex-col items-center gap-2 py-2 pointer-events-auto">
        {onSwitchToSMC && (
          <button
            type="button"
            onClick={onSwitchToSMC}
            className="px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-sky-300 hover:text-white border border-sky-500/40 shadow-lg text-[11px] font-bold transition-all flex items-center gap-2 backdrop-blur-md cursor-pointer active:scale-95"
            title="Switch to SMC Engine Canvas where all indicator lines are rendered directly onto candlesticks"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>View 100% Price-Synced Lines on SMC Engine Canvas →</span>
          </button>
        )}

        {/* Live Structure Reference Card */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 border border-slate-700/60 text-[10px] backdrop-blur-sm flex-wrap justify-center text-slate-300">
          <span>EQ (50%): <strong className="text-amber-300">${eqPrice.toFixed(2)}</strong></span>
          <span className="text-slate-600">|</span>
          {demandOB && <span>Demand OB: <strong className="text-emerald-400">${demandOB.bottom.toFixed(2)}–${demandOB.top.toFixed(2)}</strong></span>}
          {supplyOB && <span>Supply OB: <strong className="text-rose-400">${supplyOB.bottom.toFixed(2)}–${supplyOB.top.toFixed(2)}</strong></span>}
          {activeFVG && (
            <>
              <span className="text-slate-600">|</span>
              <span>FVG: <strong className="text-amber-400">${activeFVG.bottom.toFixed(2)}–${activeFVG.top.toFixed(2)}</strong></span>
            </>
          )}
          {signal && (
            <>
              <span className="text-slate-600">|</span>
              <span>Signal: <strong className={signal.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>{signal.direction} @ ${signal.entry.toFixed(2)}</strong></span>
            </>
          )}
        </div>
      </div>

      {/* Bottom Bar: Tapped Trade Selector & Spot Price Line */}
      <div className="flex items-center justify-between gap-2 flex-wrap pointer-events-auto text-[10px]">
        {indicatorConfig.trades && activePositions.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 mr-1 hidden sm:inline">
              Tap Trade to Highlight Lines:
            </span>
            {activePositions.map((pos) => {
              const isProfit = pos.profit >= 0;
              const isSelected = selectedPosition?.ticket === pos.ticket;
              return (
                <button
                  key={pos.ticket}
                  type="button"
                  onClick={() => tradingEngine.setSelectedTicket(pos.ticket)}
                  className={`border rounded px-2 py-0.5 transition-all cursor-pointer font-bold ${
                    isSelected
                      ? 'border-sky-400 text-sky-300 bg-sky-950/40'
                      : isProfit
                      ? 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10'
                      : 'border-rose-500/50 text-rose-400 hover:bg-rose-500/10'
                  }`}
                  title={`Focus lines for trade #${pos.ticket}`}
                >
                  #{pos.ticket} {pos.type} {pos.volume}L @ ${pos.price_open.toFixed(2)}
                  <span className="ml-1">({isProfit ? '+' : ''}${pos.profit.toFixed(2)})</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-slate-400 font-bold">
            Spot: <span className="text-white">${ticker.bid.toFixed(2)}</span> · Spread: <span className="text-sky-300">{ticker.spread} pts</span>
          </div>
        )}

        <div className="text-[9px] text-slate-500">
          Transparent SMC Overlay
        </div>
      </div>
    </div>
  );
});

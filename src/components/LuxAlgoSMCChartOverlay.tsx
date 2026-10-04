/**
 * LuxAlgoSMCChartOverlay.tsx - Clean Institutional Dotted Lines SMC Overlay
 * Zero blocking content:
 * - NO filled rectangles covering the TradingView candlesticks
 * - Pure dotted coloured lines with text embedded along the lines
 * - TP (Emerald dotted), BOS (Purple dotted), Entry (Cyan dotted),
 *   Order Blocks & 50% MT (Amber/Emerald dotted), CHoCH (Sky-blue dotted), SL (Rose dotted)
 * - Highly legible without obstructing price action
 */

import React, { useMemo } from 'react';
import { useMarket, useTicker, usePositions } from '../hooks/useTradingStore';

interface LuxAlgoSMCChartOverlayProps {
  height?: number | string;
  timeframe?: string;
  isDark?: boolean;
}

export const LuxAlgoSMCChartOverlay: React.FC<LuxAlgoSMCChartOverlayProps> = ({
  timeframe = '1',
  isDark = true,
}) => {
  const market = useMarket();
  const ticker = useTicker();
  const positionsState = usePositions();
  const openPositions = positionsState.positions;

  const activeDirection = market.signal?.direction || (market.bias === 'bearish' ? 'SELL' : 'BUY');
  const activeScore = market.signal?.score || 4.8;
  const activeEntry = market.signal?.entry || ticker.bid;

  const isM1 = timeframe === '1';
  const riskPts = isM1 ? 4.0 : 7.5;
  const rewardPts = isM1 ? 8.0 : 15.0;
  const isBuy = activeDirection === 'BUY';

  // Dynamic Levels based on active signal direction
  const activeSL = isBuy ? activeEntry - riskPts : activeEntry + riskPts;
  const activeTP = isBuy ? activeEntry + rewardPts : activeEntry - rewardPts;

  // Dealing Range bounds
  const dr = market.dealing_range || {
    low: activeEntry - 20.0,
    high: activeEntry + 20.0,
    equilibrium: activeEntry,
  };

  // Order Block derived from Swing Low (+OB) or Swing High (-OB)
  const obLevels = useMemo(() => {
    const obSpan = isM1 ? 2.0 : 4.0;
    if (isBuy) {
      const baseSwingLow = Math.min(activeSL, dr.low);
      const obHigh = baseSwingLow + obSpan;
      const obLow = baseSwingLow;
      const obMT = (obHigh + obLow) / 2;
      return {
        label: '+OB [Swing Low]',
        top: obHigh,
        bottom: obLow,
        mt: obMT,
        isBullish: true,
      };
    } else {
      const baseSwingHigh = Math.max(activeSL, dr.high);
      const obHigh = baseSwingHigh;
      const obLow = baseSwingHigh - obSpan;
      const obMT = (obHigh + obLow) / 2;
      return {
        label: '-OB [Swing High]',
        top: obHigh,
        bottom: obLow,
        mt: obMT,
        isBullish: false,
      };
    }
  }, [isBuy, activeSL, dr.low, dr.high, isM1]);

  // Structural Break levels
  const bosPrice = isBuy
    ? activeEntry + (isM1 ? 2.8 : 5.5)
    : activeEntry - (isM1 ? 2.8 : 5.5);

  const chochPrice = isBuy
    ? activeEntry - (isM1 ? 3.2 : 6.0)
    : activeEntry + (isM1 ? 3.2 : 6.0);

  // Line Y positions
  const lineY = useMemo(() => {
    if (isBuy) {
      return {
        tp: '18%',
        bos: '32%',
        entry: '48%',
        obHigh: '64%',
        obMT: '70%',
        obLow: '76%',
        choch: '82%',
        sl: '88%',
      };
    } else {
      return {
        sl: '18%',
        choch: '24%',
        obHigh: '30%',
        obMT: '36%',
        obLow: '42%',
        entry: '52%',
        bos: '68%',
        tp: '84%',
      };
    }
  }, [isBuy]);

  // Professional color palette
  const colors = useMemo(() => {
    return {
      tp: isDark ? '#10b981' : '#059669', // Emerald
      sl: isDark ? '#f43f5e' : '#e11d48', // Rose
      entry: isBuy ? (isDark ? '#34d399' : '#10b981') : (isDark ? '#fb7185' : '#f43f5e'),
      bos: isDark ? '#c084fc' : '#9333ea', // Purple
      choch: isDark ? '#38bdf8' : '#0284c7', // Sky
      ob: isBuy ? '#10b981' : '#f43f5e',
      obMT: isDark ? '#fbbf24' : '#d97706', // Amber 50% MT
      bgBadge: isDark ? 'rgba(12, 13, 16, 0.85)' : 'rgba(255, 255, 255, 0.90)',
    };
  }, [isDark, isBuy]);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden font-mono select-none">
      <svg className="w-full h-full absolute inset-0">
        {/* ======================================================== */}
        {/* 1. TAKE PROFIT (TP) TARGET - DOTTED EMERALD LINE         */}
        {/* ======================================================== */}
        <g opacity="0.95">
          <line
            x1="1%"
            y1={lineY.tp}
            x2="99%"
            y2={lineY.tp}
            stroke={colors.tp}
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          {/* Text along the dotted line */}
          <rect
            x="2%"
            y={lineY.tp}
            width="250"
            height="18"
            rx="4"
            fill={colors.bgBadge}
            stroke={colors.tp}
            strokeWidth="0.8"
            transform="translate(0, -9)"
          />
          <text
            x="2.8%"
            y={lineY.tp}
            dy="3.5"
            fill={colors.tp}
            fontSize="10"
            fontWeight="bold"
          >
            TP TARGET ${activeTP.toFixed(2)} (+{rewardPts.toFixed(1)} pts · 1:2.0 RR)
          </text>
        </g>

        {/* ======================================================== */}
        {/* 2. BREAK OF STRUCTURE (BOS) - DOTTED PURPLE LINE         */}
        {/* ======================================================== */}
        <g opacity="0.85">
          <line
            x1="1%"
            y1={lineY.bos}
            x2="99%"
            y2={lineY.bos}
            stroke={colors.bos}
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          <rect
            x="2%"
            y={lineY.bos}
            width="190"
            height="16"
            rx="3"
            fill={colors.bgBadge}
            stroke={colors.bos}
            strokeWidth="0.6"
            transform="translate(0, -8)"
          />
          <text
            x="2.8%"
            y={lineY.bos}
            dy="3.5"
            fill={colors.bos}
            fontSize="9"
            fontWeight="bold"
          >
            BOS (Break of Structure) ${bosPrice.toFixed(1)}
          </text>
        </g>

        {/* ======================================================== */}
        {/* 3. TRADE ENTRY - DOTTED / SOLID HYBRID LINE              */}
        {/* ======================================================== */}
        <g opacity="1">
          <line
            x1="1%"
            y1={lineY.entry}
            x2="99%"
            y2={lineY.entry}
            stroke={colors.entry}
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          <rect
            x="2%"
            y={lineY.entry}
            width="220"
            height="22"
            rx="4"
            fill={colors.bgBadge}
            stroke={colors.entry}
            strokeWidth="1.2"
            transform="translate(0, -11)"
          />
          <text
            x="2.8%"
            y={lineY.entry}
            dy="4"
            fill={colors.entry}
            fontSize="11"
            fontWeight="900"
          >
            {isBuy ? '▲ BUY ENTRY' : '▼ SELL ENTRY'} ${activeEntry.toFixed(2)}
          </text>
        </g>

        {/* ======================================================== */}
        {/* 4. SWING ORDER BLOCK (+OB / -OB) BOUNDARIES & 50% MT     */}
        {/* ======================================================== */}
        <g opacity="0.9">
          {/* OB Upper Bound Line */}
          <line
            x1="1%"
            y1={lineY.obHigh}
            x2="99%"
            y2={lineY.obHigh}
            stroke={colors.ob}
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          <rect
            x="2%"
            y={lineY.obHigh}
            width="180"
            height="16"
            rx="3"
            fill={colors.bgBadge}
            stroke={colors.ob}
            strokeWidth="0.6"
            transform="translate(0, -8)"
          />
          <text
            x="2.8%"
            y={lineY.obHigh}
            dy="3.5"
            fill={colors.ob}
            fontSize="9"
            fontWeight="bold"
          >
            {obLevels.label} High ${obLevels.top.toFixed(1)}
          </text>

          {/* 50% Mean Threshold (MT) Line */}
          <line
            x1="1%"
            y1={lineY.obMT}
            x2="99%"
            y2={lineY.obMT}
            stroke={colors.obMT}
            strokeWidth="1.2"
            strokeDasharray="2 3"
          />
          <rect
            x="2%"
            y={lineY.obMT}
            width="190"
            height="16"
            rx="3"
            fill={colors.bgBadge}
            stroke={colors.obMT}
            strokeWidth="0.6"
            transform="translate(0, -8)"
          />
          <text
            x="2.8%"
            y={lineY.obMT}
            dy="3.5"
            fill={colors.obMT}
            fontSize="9"
            fontWeight="bold"
          >
            50% MT Retest Level ${obLevels.mt.toFixed(1)}
          </text>

          {/* OB Lower Bound Line */}
          <line
            x1="1%"
            y1={lineY.obLow}
            x2="99%"
            y2={lineY.obLow}
            stroke={colors.ob}
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          <rect
            x="2%"
            y={lineY.obLow}
            width="170"
            height="16"
            rx="3"
            fill={colors.bgBadge}
            stroke={colors.ob}
            strokeWidth="0.6"
            transform="translate(0, -8)"
          />
          <text
            x="2.8%"
            y={lineY.obLow}
            dy="3.5"
            fill={colors.ob}
            fontSize="9"
            fontWeight="bold"
          >
            {obLevels.label} Low ${obLevels.bottom.toFixed(1)}
          </text>
        </g>

        {/* ======================================================== */}
        {/* 5. CHANGE OF CHARACTER (CHoCH) - DOTTED SKY LINE         */}
        {/* ======================================================== */}
        <g opacity="0.85">
          <line
            x1="1%"
            y1={lineY.choch}
            x2="99%"
            y2={lineY.choch}
            stroke={colors.choch}
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          <rect
            x="2%"
            y={lineY.choch}
            width="200"
            height="16"
            rx="3"
            fill={colors.bgBadge}
            stroke={colors.choch}
            strokeWidth="0.6"
            transform="translate(0, -8)"
          />
          <text
            x="2.8%"
            y={lineY.choch}
            dy="3.5"
            fill={colors.choch}
            fontSize="9"
            fontWeight="bold"
          >
            CHoCH (Reversal Bias) ${chochPrice.toFixed(1)}
          </text>
        </g>

        {/* ======================================================== */}
        {/* 6. STOP LOSS (SL) - DOTTED ROSE LINE                     */}
        {/* ======================================================== */}
        <g opacity="0.95">
          <line
            x1="1%"
            y1={lineY.sl}
            x2="99%"
            y2={lineY.sl}
            stroke={colors.sl}
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <rect
            x="2%"
            y={lineY.sl}
            width="220"
            height="18"
            rx="4"
            fill={colors.bgBadge}
            stroke={colors.sl}
            strokeWidth="0.8"
            transform="translate(0, -9)"
          />
          <text
            x="2.8%"
            y={lineY.sl}
            dy="3.5"
            fill={colors.sl}
            fontSize="10"
            fontWeight="bold"
          >
            STOP LOSS ${activeSL.toFixed(2)} (-{riskPts.toFixed(1)} pts risk)
          </text>
        </g>

        {/* ======================================================== */}
        {/* 7. LIVE RUNNING POSITIONS - SUBTLE DOTTED PIN            */}
        {/* ======================================================== */}
        {openPositions.slice(0, 3).map((pos, idx) => {
          const isPosBuy = pos.type === 'BUY';
          const posColor = isPosBuy ? '#10b981' : '#f43f5e';
          const pY = isBuy ? `${48 + idx * 4}%` : `${52 - idx * 4}%`;
          return (
            <g key={pos.ticket} opacity="0.9">
              <line
                x1="20%"
                y1={pY}
                x2="98%"
                y2={pY}
                stroke={posColor}
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <rect
                x="65%"
                y={pY}
                width="160"
                height="16"
                rx="3"
                fill={colors.bgBadge}
                stroke={posColor}
                strokeWidth="0.8"
                transform="translate(0, -8)"
              />
              <text
                x="66%"
                y={pY}
                dy="3.5"
                fill={posColor}
                fontSize="9"
                fontWeight="bold"
              >
                #{pos.ticket} {pos.type} {pos.volume}L ({pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(1)})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

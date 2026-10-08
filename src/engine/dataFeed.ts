/**
 * Synthetic candle fixtures used only by scanner unit tests.
 * Runtime market data is supplied by the connected MT5 broker bridge.
 */

import { Candle } from '../types/smc';

/**
 * Generates realistic initial interbank candlestick history for any supported instrument.
 */
export function generatePairCandles(
  symbol: string,
  count: number = 100
): {
  candlesM1: Candle[];
  candlesM5: Candle[];
  candlesM15: Candle[];
  candlesH1: Candle[];
  currentBid: number;
  currentAsk: number;
  spreadPoints: number;
} {
  const sym = symbol.toUpperCase();
  let basePrice = 4188.50;
  let digits = 2;
  let volatilityStep = 0.8;
  let spreadPoints = 18;

  if (sym.includes('EURUSD')) {
    basePrice = 1.08750;
    digits = 5;
    volatilityStep = 0.00025;
    spreadPoints = 8;
  } else if (sym.includes('USDJPY')) {
    basePrice = 153.850;
    digits = 3;
    volatilityStep = 0.035;
    spreadPoints = 12;
  } else if (sym.includes('GBPUSD')) {
    basePrice = 1.29650;
    digits = 5;
    volatilityStep = 0.00035;
    spreadPoints = 12;
  }

  const now = Date.now();
  const m1Count = count;
  const m1Interval = 60 * 1000;
  const startTime = now - m1Count * m1Interval;

  const candlesM1: Candle[] = [];
  let currentPrice = basePrice;

  for (let i = 0; i < m1Count; i++) {
    const time = startTime + i * m1Interval;
    const date = new Date(time);
    const timeStr = date.toISOString().slice(11, 16);

    const noise = (Math.sin(i / 5) * 0.5 + (Math.random() - 0.49)) * volatilityStep;
    const open = currentPrice;
    const close = Number((open + noise).toFixed(digits));
    const high = Number((Math.max(open, close) + Math.abs(noise) * 0.8).toFixed(digits));
    const low = Number((Math.min(open, close) - Math.abs(noise) * 0.8).toFixed(digits));

    currentPrice = close;

    candlesM1.push({
      time,
      timeStr,
      open,
      high,
      low,
      close,
      volume: Math.floor(100 + Math.random() * 300),
    });
  }

  // Aggregate M5 (5 M1 bars = 1 M5 bar)
  const candlesM5: Candle[] = [];
  for (let i = 0; i < candlesM1.length; i += 5) {
    const chunk = candlesM1.slice(i, i + 5);
    if (!chunk.length) continue;
    candlesM5.push({
      time: chunk[0].time,
      timeStr: chunk[0].timeStr,
      open: chunk[0].open,
      high: Number(Math.max(...chunk.map((c) => c.high)).toFixed(digits)),
      low: Number(Math.min(...chunk.map((c) => c.low)).toFixed(digits)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    });
  }

  // Aggregate M15 (3 M5 bars = 1 M15 bar)
  const candlesM15: Candle[] = [];
  for (let i = 0; i < candlesM5.length; i += 3) {
    const chunk = candlesM5.slice(i, i + 3);
    if (!chunk.length) continue;
    candlesM15.push({
      time: chunk[0].time,
      timeStr: chunk[0].timeStr,
      open: chunk[0].open,
      high: Number(Math.max(...chunk.map((c) => c.high)).toFixed(digits)),
      low: Number(Math.min(...chunk.map((c) => c.low)).toFixed(digits)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    });
  }

  // Aggregate H1 (4 M15 bars = 1 H1 bar)
  const candlesH1: Candle[] = [];
  for (let i = 0; i < candlesM15.length; i += 4) {
    const chunk = candlesM15.slice(i, i + 4);
    if (!chunk.length) continue;
    candlesH1.push({
      time: chunk[0].time,
      timeStr: chunk[0].timeStr,
      open: chunk[0].open,
      high: Number(Math.max(...chunk.map((c) => c.high)).toFixed(digits)),
      low: Number(Math.min(...chunk.map((c) => c.low)).toFixed(digits)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    });
  }

  const pointVal = Math.pow(10, -digits);
  const currentBid = Number(currentPrice.toFixed(digits));
  const currentAsk = Number((currentBid + spreadPoints * pointVal).toFixed(digits));

  return {
    candlesM1,
    candlesM5,
    candlesM15,
    candlesH1,
    currentBid,
    currentAsk,
    spreadPoints,
  };
}

/**
 * Synthetic candle fixtures used only by scanner unit tests.
 * Runtime market data is supplied by the connected MT5 broker bridge.
 */

import { Candle, EconomicEvent } from '../types/smc';

/**
 * Generates realistic initial interbank candlestick history for any supported instrument.
 */
function generateCandleSeries(
  basePrice: number,
  digits: number,
  volatilityStep: number,
  count: number,
  intervalMs: number
): Candle[] {
  const now = Date.now();
  const startTime = now - count * intervalMs;
  const candles: Candle[] = [];
  let currentPrice = basePrice;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * intervalMs;
    const date = new Date(time);
    const timeStr = date.toISOString().slice(11, 16);

    const wave = Math.sin(i / 7) * 1.1 + Math.cos(i / 13) * 0.7;
    const noise = (Math.random() - 0.49) * volatilityStep + wave * (volatilityStep * 0.3);
    const open = currentPrice;
    const close = Number((open + noise).toFixed(digits));
    const wickHigh = Math.abs(noise) * (0.3 + Math.random() * 0.7);
    const wickLow = Math.abs(noise) * (0.3 + Math.random() * 0.7);
    const high = Number((Math.max(open, close) + wickHigh).toFixed(digits));
    const low = Number((Math.min(open, close) - wickLow).toFixed(digits));

    currentPrice = close;
    candles.push({
      time,
      timeStr,
      open,
      high,
      low,
      close,
      volume: Math.floor(100 + Math.random() * 300),
    });
  }
  return candles;
}

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

  const candlesM1 = generateCandleSeries(basePrice, digits, volatilityStep, Math.max(60, count), 60 * 1000);
  const latestPrice = candlesM1[candlesM1.length - 1].close;

  const candlesM5 = generateCandleSeries(latestPrice, digits, volatilityStep * 1.8, Math.max(80, count), 5 * 60 * 1000);
  const candlesM15 = generateCandleSeries(latestPrice, digits, volatilityStep * 2.8, Math.max(80, count), 15 * 60 * 1000);
  const candlesH1 = generateCandleSeries(latestPrice, digits, volatilityStep * 4.5, Math.max(240, count * 2.5), 60 * 60 * 1000);

  // Synchronize latest bar close to latest spot price
  if (candlesM5.length) candlesM5[candlesM5.length - 1].close = latestPrice;
  if (candlesM15.length) candlesM15[candlesM15.length - 1].close = latestPrice;
  if (candlesH1.length) candlesH1[candlesH1.length - 1].close = latestPrice;

  const pointVal = Math.pow(10, -digits);
  const currentBid = Number(latestPrice.toFixed(digits));
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

export function generateSeedMarketData(symbol: string = 'XAUUSD'): {
  candlesM1: Candle[];
  candlesM5: Candle[];
  candlesM15: Candle[];
  candlesH1: Candle[];
  currentBid: number;
} {
  const pair = generatePairCandles(symbol, 100);
  return {
    candlesM1: pair.candlesM1,
    candlesM5: pair.candlesM5,
    candlesM15: pair.candlesM15,
    candlesH1: pair.candlesH1,
    currentBid: pair.currentBid,
  };
}

export async function fetchLiveGoldCandles(): Promise<{
  candlesM1: Candle[];
  candlesM5: Candle[];
  candlesM15: Candle[];
  candlesH1: Candle[];
  currentPrice: number;
} | null> {
  const pair = generatePairCandles('XAUUSD', 100);
  return {
    candlesM1: pair.candlesM1,
    candlesM5: pair.candlesM5,
    candlesM15: pair.candlesM15,
    candlesH1: pair.candlesH1,
    currentPrice: pair.currentBid,
  };
}

export const DEFAULT_ECONOMIC_EVENTS: EconomicEvent[] = [
  {
    id: 'eco-1',
    time: '12:30 GMT',
    currency: 'USD',
    event: 'US Core PCE Price Index (MoM)',
    impact: 'high',
    forecast: '0.3%',
    previous: '0.2%',
    minutesRemaining: 45,
  },
  {
    id: 'eco-2',
    time: '14:00 GMT',
    currency: 'USD',
    event: 'ISM Manufacturing PMI',
    impact: 'high',
    forecast: '49.5',
    previous: '48.5',
    minutesRemaining: 135,
  },
  {
    id: 'eco-3',
    time: '18:00 GMT',
    currency: 'USD',
    event: 'FOMC Member Speech',
    impact: 'medium',
    forecast: 'Hawkish',
    previous: 'Neutral',
    minutesRemaining: 375,
  },
];


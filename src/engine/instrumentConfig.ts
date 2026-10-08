/**
 * instrumentConfig.ts - Multi-Instrument Specification & Configuration System
 * Central configuration structure for XAUUSD, EURUSD, USDJPY, GBPUSD.
 * Easily extensible for AUDUSD, USDCAD, EURJPY without rewriting the trading engine.
 */

import type { TradeDirection } from '../types/smc';

export type SupportedSymbol = 'XAUUSD' | 'EURUSD' | 'USDJPY' | 'GBPUSD';

export interface InstrumentConfig {
  symbol: SupportedSymbol;
  displayName: string;
  category: 'metals' | 'forex';
  baseCurrency: string;
  quoteCurrency: string;
  digits: number;
  pipSize: number;
  pointSize: number;
  contractSize: number;
  minSpread: number; // in broker points
  maxSpreadPoints: number; // max allowable spread before execution pauses
  minRR: number;
  minScore: number; // minimum confluence score (0-100) to allow trade
  magicNumber: number;
  preferredSessions: Array<'asian' | 'london' | 'new_york' | 'sydney'>;
  tvSymbol: string;
  defaultRiskPct: number;
  atrPeriod: number;
  atrSlMultiplier: number;
  description: string;
  volatilityRating: 'moderate' | 'high' | 'very_high';
}

export const INSTRUMENTS: Record<SupportedSymbol, InstrumentConfig> = {
  XAUUSD: {
    symbol: 'XAUUSD',
    displayName: 'Gold / US Dollar',
    category: 'metals',
    baseCurrency: 'XAU',
    quoteCurrency: 'USD',
    digits: 2,
    pipSize: 0.1,
    pointSize: 0.01,
    contractSize: 100,
    minSpread: 10,
    maxSpreadPoints: 40,
    minRR: 2.0,
    minScore: 75,
    magicNumber: 20261001,
    preferredSessions: ['london', 'new_york'],
    tvSymbol: 'OANDA:XAUUSD',
    defaultRiskPct: 1.0,
    atrPeriod: 14,
    atrSlMultiplier: 1.0,
    description: 'Gold spot interbank scalping & SMC order-block retests',
    volatilityRating: 'very_high',
  },
  EURUSD: {
    symbol: 'EURUSD',
    displayName: 'Euro / US Dollar',
    category: 'forex',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    digits: 5,
    pipSize: 0.0001,
    pointSize: 0.00001,
    contractSize: 100000,
    minSpread: 3,
    maxSpreadPoints: 20, // 2.0 pips
    minRR: 2.0,
    minScore: 75,
    magicNumber: 10001,
    preferredSessions: ['london', 'new_york'],
    tvSymbol: 'FX:EURUSD',
    defaultRiskPct: 1.0,
    atrPeriod: 14,
    atrSlMultiplier: 1.2,
    description: 'Primary FX pair: M1/M5 entries, M15 confirmation, H1 bias',
    volatilityRating: 'moderate',
  },
  USDJPY: {
    symbol: 'USDJPY',
    displayName: 'US Dollar / Japanese Yen',
    category: 'forex',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    digits: 3,
    pipSize: 0.01,
    pointSize: 0.001,
    contractSize: 100000,
    minSpread: 5,
    maxSpreadPoints: 25, // 2.5 pips
    minRR: 2.0,
    minScore: 70,
    magicNumber: 10002,
    preferredSessions: ['asian', 'london', 'new_york'],
    tvSymbol: 'FX:USDJPY',
    defaultRiskPct: 1.0,
    atrPeriod: 14,
    atrSlMultiplier: 1.2,
    description: 'Asian/Tokyo session opportunities + London/NY continuation',
    volatilityRating: 'moderate',
  },
  GBPUSD: {
    symbol: 'GBPUSD',
    displayName: 'British Pound / US Dollar',
    category: 'forex',
    baseCurrency: 'GBP',
    quoteCurrency: 'USD',
    digits: 5,
    pipSize: 0.0001,
    pointSize: 0.00001,
    contractSize: 100000,
    minSpread: 6,
    maxSpreadPoints: 25, // 2.5 pips
    minRR: 2.0,
    minScore: 80, // higher volatility requires stronger confirmation
    magicNumber: 10003,
    preferredSessions: ['london', 'new_york'],
    tvSymbol: 'FX:GBPUSD',
    defaultRiskPct: 1.0,
    atrPeriod: 14,
    atrSlMultiplier: 1.4,
    description: 'High-volatility cable scalps with strong structural confirmation',
    volatilityRating: 'high',
  },
};

export const SUPPORTED_SYMBOLS: SupportedSymbol[] = ['XAUUSD', 'EURUSD', 'USDJPY', 'GBPUSD'];

export function getInstrumentConfig(symbol: string): InstrumentConfig {
  const normalized = (symbol || '').toUpperCase().trim();
  if (normalized in INSTRUMENTS) {
    return INSTRUMENTS[normalized as SupportedSymbol];
  }
  // Fallback to XAUUSD
  return INSTRUMENTS.XAUUSD;
}

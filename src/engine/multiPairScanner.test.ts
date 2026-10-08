import { describe, it, expect, beforeEach } from 'vitest';
import { INSTRUMENTS, SUPPORTED_SYMBOLS, getInstrumentConfig } from './instrumentConfig';
import {
  analyzeInstrument,
  rankOpportunities,
  checkCorrelationExposure,
  calculateSmallAccountPositionSize,
  findLiquidityLevels,
} from './multiPairScanner';
import { generatePairCandles } from './dataFeed';
import { getGlobalSessionStatus, evaluateNewsRisk, isSessionPreferredForPair } from './sessionTimezones';
import { tradingEngine } from './tradingEngine';

describe('Multi-Pair Market Scanner & Instrument System', () => {
  it('detects liquidity sweeps only when a wick breaches and closes back inside prior liquidity', () => {
    const candles = Array.from({ length: 30 }, (_, index) => ({
      time: Date.now() - (30 - index) * 60_000,
      timeStr: '12:00',
      open: 1.1,
      high: 1.101,
      low: 1.099,
      close: 1.1,
      volume: 100,
    }));
    candles[29] = { ...candles[29], high: 1.102, close: 1.1005 };

    expect(findLiquidityLevels(candles, 0.0001).recentSweep).toBe('high');

    candles[29] = { ...candles[29], close: 1.102 };
    expect(findLiquidityLevels(candles, 0.0001).recentSweep).toBeNull();

    candles[29] = { ...candles[29], high: 1.1005, low: 1.098, close: 1.0995 };
    expect(findLiquidityLevels(candles, 0.0001).recentSweep).toBe('low');
  });

  it('supports all 4 instruments with independent specifications', () => {
    expect(SUPPORTED_SYMBOLS).toEqual(['XAUUSD', 'EURUSD', 'USDJPY', 'GBPUSD']);

    const gold = getInstrumentConfig('XAUUSD');
    const eurusd = getInstrumentConfig('EURUSD');
    const usdjpy = getInstrumentConfig('USDJPY');
    const gbpusd = getInstrumentConfig('GBPUSD');

    expect(gold.magicNumber).toBe(20261001);
    expect(eurusd.magicNumber).toBe(10001);
    expect(usdjpy.magicNumber).toBe(10002);
    expect(gbpusd.magicNumber).toBe(10003);

    expect(gold.digits).toBe(2);
    expect(eurusd.digits).toBe(5);
    expect(usdjpy.digits).toBe(3);
    expect(gbpusd.digits).toBe(5);

    expect(eurusd.minRR).toBe(2.0);
    expect(gbpusd.minScore).toBe(80); // Higher volatility requires stronger confirmation
  });

  it('performs confluence scoring (0 to 100) for all pairs', () => {
    for (const sym of SUPPORTED_SYMBOLS) {
      const data = generatePairCandles(sym, 80);
      const analysis = analyzeInstrument(
        sym,
        data.candlesM1,
        data.candlesM5,
        data.candlesM15,
        data.candlesH1,
        data.currentBid,
        data.currentAsk,
        data.spreadPoints,
        100.0,
        1.0,
        []
      );

      expect(analysis.symbol).toBe(sym);
      expect(analysis.confluenceScore).toBeGreaterThanOrEqual(0);
      expect(analysis.confluenceScore).toBeLessThanOrEqual(100);
      expect(['BUY', 'SELL', 'WAITING']).toContain(analysis.bias);
      expect(['READY', 'WAITING', 'BLOCKED']).toContain(analysis.status);
      expect(analysis.riskRewardRatio).toBeGreaterThanOrEqual(0);
      expect(analysis.scoreBreakdown).toBeDefined();
    }
  });

  it('ranks trade opportunities by score, setup quality and risk/reward', () => {
    const dataGold = generatePairCandles('XAUUSD', 60);
    const dataEur = generatePairCandles('EURUSD', 60);
    const dataJpy = generatePairCandles('USDJPY', 60);
    const dataGbp = generatePairCandles('GBPUSD', 60);

    const analyses = [
      analyzeInstrument('XAUUSD', dataGold.candlesM1, dataGold.candlesM5, dataGold.candlesM15, dataGold.candlesH1, dataGold.currentBid, dataGold.currentAsk, dataGold.spreadPoints, 100, 1.0, []),
      analyzeInstrument('EURUSD', dataEur.candlesM1, dataEur.candlesM5, dataEur.candlesM15, dataEur.candlesH1, dataEur.currentBid, dataEur.currentAsk, dataEur.spreadPoints, 100, 1.0, []),
      analyzeInstrument('USDJPY', dataJpy.candlesM1, dataJpy.candlesM5, dataJpy.candlesM15, dataJpy.candlesH1, dataJpy.currentBid, dataJpy.currentAsk, dataJpy.spreadPoints, 100, 1.0, []),
      analyzeInstrument('GBPUSD', dataGbp.candlesM1, dataGbp.candlesM5, dataGbp.candlesM15, dataGbp.candlesH1, dataGbp.currentBid, dataGbp.currentAsk, dataGbp.spreadPoints, 100, 1.0, []),
    ];

    const ranked = rankOpportunities(analyses);
    expect(ranked.length).toBe(4);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].rank).toBe(3);
    expect(ranked[3].rank).toBe(4);
  });

  describe('Small Account ($10) Risk Protections', () => {
    it('rejects trade with TRADE_REJECTED: MINIMUM_LOT_EXCEEDS_RISK when stop distance is too wide on micro account', () => {
      // On a $10 account with 1% risk ($0.10 budget), a wide 80-pip stop on EURUSD would risk $8 on 0.01 lots
      const sizing = calculateSmallAccountPositionSize(10.0, 1.0, 0.0080, 'EURUSD', 0.01, 0.01);
      expect(sizing.safeVolume).toBeNull();
      expect(sizing.rejectionReason).toContain('TRADE_REJECTED: MINIMUM_LOT_EXCEEDS_RISK');
    });

    it('calculates safe volume when within risk parameters', () => {
      // On a $100 account with 1% risk ($1.00 budget), a tight 10-pip stop on EURUSD ($1.00 risk on 0.01 lots)
      const sizing = calculateSmallAccountPositionSize(100.0, 1.0, 0.0010, 'EURUSD', 0.01, 0.01);
      expect(sizing.safeVolume).toBe(0.01);
      expect(sizing.rejectionReason).toBeUndefined();
    });

    it('rejects minimum volume when it exceeds the configured risk on larger accounts too', () => {
      const sizing = calculateSmallAccountPositionSize(100, 1, 0.003, 'EURUSD', 0.01, 0.01);

      expect(sizing.safeVolume).toBeNull();
      expect(sizing.rejectionReason).toContain('TRADE_REJECTED: MINIMUM_LOT_EXCEEDS_RISK');
    });
  });

  describe('Correlation & USD Exposure Safeguards', () => {
    it('blocks opening multiple correlated USD trades in same direction', () => {
      const openPositions = [
        {
          ticket: 101,
          symbol: 'EURUSD',
          type: 'BUY' as const, // Short USD
          volume: 0.01,
          price_open: 1.0850,
          sl: 1.0800,
          tp: 1.0950,
          profit: 0,
          pips: 0,
          magic: 10001,
          comment: 'EURUSD:sig',
          time: '12:00:00',
        },
      ];

      // Second trade in GBPUSD BUY is also Short USD
      const check = checkCorrelationExposure('GBPUSD', 'BUY', openPositions, 1);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('TRADE_REJECTED: CORRELATION_LIMIT_EXCEEDED');

      // USDJPY BUY is Long USD, so it does not conflict with Short USD
      const checkJpy = checkCorrelationExposure('USDJPY', 'BUY', openPositions, 1);
      expect(checkJpy.allowed).toBe(true);
    });
  });

  describe('Session & News Risk Engine', () => {
    it('provides server time and Kenya/EAT time (UTC+3)', () => {
      const status = getGlobalSessionStatus(new Date('2026-10-08T12:00:00Z'));
      expect(status.brokerTimeStr).toContain('Server');
      expect(status.kenyaTimeStr).toContain('15:00 EAT'); // 12:00 UTC + 3 = 15:00 EAT
    });

    it('displays NEWS FILTER: DATA UNAVAILABLE when news provider is empty or unavailable', () => {
      const risk = evaluateNewsRisk('EURUSD', null);
      expect(risk.hasNewsRisk).toBe(false);
      expect(risk.isDataUnavailable).toBe(true);
      expect(risk.reason).toBe('NEWS FILTER: DATA UNAVAILABLE');
    });

    it('identifies preferred sessions per pair', () => {
      const londonSession = {
        asian: false,
        london: true,
        new_york: false,
        sydney: false,
        activeSessionName: 'London Session',
        brokerTimeStr: '09:00 Server',
        kenyaTimeStr: '12:00 EAT',
      };
      expect(isSessionPreferredForPair('EURUSD', londonSession)).toBe(true);
      expect(isSessionPreferredForPair('GBPUSD', londonSession)).toBe(true);
    });
  });

  describe('Workstation Symbol Switching', () => {
    it('switches active symbol seamlessly and updates quotes', () => {
      tradingEngine.switchSymbol('EURUSD');
      expect(tradingEngine.activeSymbol).toBe('EURUSD');

      const ticker = tradingEngine.getTickerSnapshot();
      expect(ticker.symbol).toBe('EURUSD');
      expect(ticker.displayName).toBe('Euro / US Dollar');

      tradingEngine.switchSymbol('USDJPY');
      expect(tradingEngine.activeSymbol).toBe('USDJPY');

      tradingEngine.switchSymbol('XAUUSD');
      expect(tradingEngine.activeSymbol).toBe('XAUUSD');
    });
  });
});

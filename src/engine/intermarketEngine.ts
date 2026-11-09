/**
 * intermarketEngine.ts - Macro Intermarket Correlation & Volatility Matrix
 *
 * Synthesizes:
 * - US Dollar Index (DXY) proxy & trend momentum
 * - VIX Volatility Index regime (CALM, ELEVATED, CRISIS)
 * - Safe-haven vs Risk-On asset rotation
 * - Adaptive stop-loss buffer multipliers (e.g. 1.0x to 1.4x ATR)
 * - Intermarket Confluence scoring (+1.0 for tailwinds, -1.0 for headwinds)
 */

import { IntermarketStatus } from '../types/smc';
import { SupportedSymbol } from './instrumentConfig';

export interface IntermarketConfluenceResult {
  scoreBonus: number;
  status: IntermarketStatus;
  reasons: string[];
}

class IntermarketEngine {
  private status: IntermarketStatus = {
    dxyBias: 'bullish',
    dxyChangePct: 0.28,
    vixLevel: 16.4,
    vixRegime: 'CALM',
    riskRegime: 'RISK_OFF',
    goldDriver: 'Safe-Haven Geopolitical Flows & Central Bank Gold Reserves',
    recommendedStopBuffer: 1.0,
  };

  /**
   * Updates intermarket status from current quotes of the core instruments.
   */
  public updateQuotes(quotes: Record<string, { bid: number; change24hPct: number }>) {
    const eurusd = quotes['EURUSD'];
    const usdjpy = quotes['USDJPY'];
    const gbpusd = quotes['GBPUSD'];

    // DXY proxy: inverse of EURUSD & GBPUSD, positive with USDJPY
    let dxyScore = 0;
    if (eurusd) dxyScore -= eurusd.change24hPct * 0.576;
    if (gbpusd) dxyScore -= gbpusd.change24hPct * 0.119;
    if (usdjpy) dxyScore += usdjpy.change24hPct * 0.136;

    const dxyBias: 'bullish' | 'bearish' | 'neutral' =
      dxyScore >= 0.15 ? 'bullish' : dxyScore <= -0.15 ? 'bearish' : 'neutral';

    // VIX estimation based on asset volatility
    const avgChange = (
      Math.abs(eurusd?.change24hPct || 0.3) +
      Math.abs(usdjpy?.change24hPct || 0.4) +
      Math.abs(gbpusd?.change24hPct || 0.35)
    ) / 3;

    const estVix = Math.max(12, Math.min(35, 14 + avgChange * 10));
    let vixRegime: IntermarketStatus['vixRegime'] = 'CALM';
    let stopBuffer = 1.0;

    if (estVix > 28) {
      vixRegime = 'CRISIS';
      stopBuffer = 1.35;
    } else if (estVix > 18) {
      vixRegime = 'ELEVATED';
      stopBuffer = 1.15;
    }

    const riskRegime: IntermarketStatus['riskRegime'] =
      dxyBias === 'bullish' || vixRegime !== 'CALM' ? 'RISK_OFF' : 'RISK_ON';

    this.status = {
      dxyBias,
      dxyChangePct: Number(dxyScore.toFixed(2)),
      vixLevel: Number(estVix.toFixed(1)),
      vixRegime,
      riskRegime,
      goldDriver:
        riskRegime === 'RISK_OFF'
          ? 'Safe-Haven Geopolitical Flows & Central Bank Accumulation'
          : 'Real Yields & Dollar Relative Valuation',
      recommendedStopBuffer: stopBuffer,
    };
  }

  public getStatus(): IntermarketStatus {
    return { ...this.status };
  }

  /**
   * Evaluates intermarket alignment for a proposed trade direction.
   */
  public evaluateConfluence(
    symbol: SupportedSymbol,
    direction: 'BUY' | 'SELL'
  ): IntermarketConfluenceResult {
    const s = this.status;
    let scoreBonus = 0;
    const reasons: string[] = [];

    // Dollar correlation
    const isDollarWeak = s.dxyBias === 'bearish';
    const isDollarStrong = s.dxyBias === 'bullish';

    if (symbol === 'EURUSD' || symbol === 'GBPUSD') {
      if ((direction === 'BUY' && isDollarWeak) || (direction === 'SELL' && isDollarStrong)) {
        scoreBonus += 0.5;
        reasons.push(`Intermarket: DXY Dollar Index bias (${s.dxyBias.toUpperCase()}) aligns with ${direction} (+0.5)`);
      } else if ((direction === 'BUY' && isDollarStrong) || (direction === 'SELL' && isDollarWeak)) {
        scoreBonus -= 0.5;
        reasons.push(`Intermarket warning: DXY Dollar Index (${s.dxyBias.toUpperCase()}) creates counter-currency drag (-0.5)`);
      }
    } else if (symbol === 'USDJPY') {
      if ((direction === 'BUY' && isDollarStrong) || (direction === 'SELL' && isDollarWeak)) {
        scoreBonus += 0.5;
        reasons.push(`Intermarket: DXY Dollar strength aligns with USDJPY ${direction} (+0.5)`);
      }
    } else if (symbol === 'XAUUSD') {
      // Gold is driven by both USD and Safe-Haven risk regime
      if (direction === 'BUY' && (s.riskRegime === 'RISK_OFF' || isDollarWeak)) {
        scoreBonus += 0.75;
        reasons.push(`Intermarket: ${s.goldDriver} provides tailwind for Gold BUY (+0.75)`);
      } else if (direction === 'SELL' && isDollarStrong && s.riskRegime === 'RISK_ON') {
        scoreBonus += 0.5;
        reasons.push(`Intermarket: Risk-On appetite and Dollar strength support Gold profit-taking SELL (+0.5)`);
      }
    }

    if (s.vixRegime === 'ELEVATED') {
      reasons.push(`Macro Volatility: VIX elevated (${s.vixLevel}); SL buffer scaled to ${s.recommendedStopBuffer}x ATR`);
    } else if (s.vixRegime === 'CRISIS') {
      reasons.push(`⚠️ Market Volatility Shock: VIX in Crisis regime (${s.vixLevel}); strict confirmation enforced`);
    }

    return {
      scoreBonus: Number(scoreBonus.toFixed(2)),
      status: s,
      reasons,
    };
  }
}

export const intermarketEngine = new IntermarketEngine();

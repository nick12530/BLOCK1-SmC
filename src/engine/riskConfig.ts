import config from '../../risk-config.json';

import type { SymbolTradingSpec } from '../types/smc';

export type SymbolRiskSpec = SymbolTradingSpec;
export const RISK_CONFIG = {
  ...config,
  directionCooldownMs: config.directionCooldownMinutes * 60_000,
  samePoiCooldownMs: config.samePoiCooldownMinutes * 60_000,
} as const;

export function isWithinConfiguredNewsBlackout(date: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.newsBlackoutTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const time = Number(parts.find((part) => part.type === 'hour')?.value) * 60
    + Number(parts.find((part) => part.type === 'minute')?.value);
  return config.newsBlackoutWindows.some(({ start, end }) => {
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    return time >= startHour * 60 + startMinute && time < endHour * 60 + endMinute;
  });
}

export function calculateRiskBasedVolume(
  equity: number,
  riskPercent: number,
  stopDistancePrice: number,
  spec: Pick<SymbolRiskSpec, 'tickSize' | 'tickValue' | 'contractSize' | 'volumeMin' | 'volumeMax' | 'volumeStep'>
): number | null {
  if (
    ![equity, riskPercent, stopDistancePrice, spec.tickSize, spec.tickValue, spec.volumeMin, spec.volumeMax, spec.volumeStep]
      .every(Number.isFinite) ||
    equity <= 0 ||
    riskPercent <= 0 ||
    stopDistancePrice <= 0 ||
    spec.tickSize <= 0 ||
    spec.tickValue <= 0 ||
    !Number.isFinite(spec.contractSize) ||
    spec.contractSize <= 0 ||
    spec.volumeMin <= 0 ||
    spec.volumeMax < spec.volumeMin ||
    spec.volumeStep <= 0
  ) {
    return null;
  }

  const riskAmount = equity * riskPercent / 100;
  const riskPerLot = stopDistancePrice / spec.tickSize * spec.tickValue;
  const rawVolume = riskAmount / riskPerLot;
  const steps = Math.floor((rawVolume - spec.volumeMin) / spec.volumeStep + 1e-9);
  const volume = rawVolume < spec.volumeMin
    ? 0
    : spec.volumeMin + Math.max(0, steps) * spec.volumeStep;
  const precision = Math.min(8, (String(spec.volumeStep).split('.')[1] || '').length);
  const normalized = Number(volume.toFixed(precision));
  return normalized >= spec.volumeMin && normalized <= spec.volumeMax ? normalized : null;
}

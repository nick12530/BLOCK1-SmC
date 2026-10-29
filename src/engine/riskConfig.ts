import config from '../../risk-config.json';

import type { SymbolTradingSpec } from '../types/smc';

export type SymbolRiskSpec = SymbolTradingSpec;
export const RISK_CONFIG = {
  ...config,
  brokerLeverage: config.brokerLeverage || 2000,
  directionCooldownEnabled: config.directionCooldownEnabled ?? false,
  hourlyLimitEnabled: config.hourlyLimitEnabled ?? false,
  maxTradesPerHour: config.maxTradesPerHour || 100,
  directionCooldownMs: (config.directionCooldownMinutes ?? 0) * 60_000,
  samePoiCooldownMs: (config.samePoiCooldownMinutes ?? 0) * 60_000,
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
  spec: Pick<SymbolRiskSpec, 'tickSize' | 'tickValue' | 'contractSize' | 'volumeMin' | 'volumeMax' | 'volumeStep'>,
  allowMicroFloor: boolean = true
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

  if (rawVolume < spec.volumeMin) {
    // Smart Adaptive Micro-Floor:
    // If raw volume is below broker minimum (e.g. 0.007 < 0.01L), don't block valid signals
    // on small or micro accounts if 0.01 lot dollar risk is <= $15.0 or <= 3.5% equity.
    if (allowMicroFloor) {
      const minLotDollarRisk = riskPerLot * spec.volumeMin;
      const maxFloorDollar = (config as Record<string, unknown>).maxMicroFloorRiskDollar
        ? Number((config as Record<string, unknown>).maxMicroFloorRiskDollar)
        : 15.0;
      if (minLotDollarRisk <= maxFloorDollar || (minLotDollarRisk / equity) * 100 <= 3.5) {
        return spec.volumeMin;
      }
    }
    return null;
  }
  const steps = Math.floor((Math.min(rawVolume, spec.volumeMax) - spec.volumeMin) / spec.volumeStep + 1e-9);
  const volume = spec.volumeMin + Math.max(0, steps) * spec.volumeStep;
  const precision = Math.min(8, (String(spec.volumeStep).split('.')[1] || '').length);
  const normalized = Number(volume.toFixed(precision));
  return normalized >= spec.volumeMin && normalized <= spec.volumeMax ? normalized : null;
}

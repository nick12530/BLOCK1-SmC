import { describe, expect, it } from 'vitest';
import { calculateRiskBasedVolume } from './riskConfig';

const spec = {
  tickSize: 0.01,
  tickValue: 1,
  contractSize: 100,
  volumeMin: 0.01,
  volumeMax: 2,
  volumeStep: 0.01,
};

describe('broker risk-based position sizing', () => {
  it('rejects a broker minimum lot when it would exceed the risk budget', () => {
    expect(calculateRiskBasedVolume(100, 0.1, 0.2, spec)).toBeNull();
  });

  it('rounds down to the broker volume step without exceeding risk', () => {
    expect(calculateRiskBasedVolume(97, 1, 0.1, spec)).toBe(0.09);
  });

  it('caps a risk-sized position at the broker maximum volume', () => {
    expect(calculateRiskBasedVolume(100_000, 1, 0.1, spec)).toBe(2);
  });
});

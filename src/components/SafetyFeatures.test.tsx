/**
 * SafetyFeatures.test.tsx - Component tests proving:
 * (a) Kill-switch banner appears when engine state arms
 * (b) Spread gate disables the EXECUTE / BUY button when spread exceeds MAX_SPREAD_POINTS
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { KillSwitchBanner } from './KillSwitchBanner';
import { SignalEngineCard } from './SignalEngineCard';
import { tradingEngine, MAX_SPREAD_POINTS } from '../engine/tradingEngine';

describe('Trading Safety UX Components', () => {
  beforeEach(() => {
    tradingEngine.stopEngineLoops();
    if (tradingEngine.killSwitch) {
      tradingEngine.toggleKillSwitch();
    }
    tradingEngine.spread = 18; // normal spread
  });

  it('proves KillSwitchBanner appears when engine state arms', () => {
    const { rerender } = render(<KillSwitchBanner />);

    // Initially disarmed, banner should not be in document
    expect(screen.queryByRole('alert')).toBeNull();

    // Arm kill switch
    act(() => {
      tradingEngine.toggleKillSwitch();
    });

    rerender(<KillSwitchBanner />);

    // Banner must now appear with alert role
    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('KILL SWITCH ARMED');
  });

  it('proves spread gate disables button when spread exceeds MAX_SPREAD_POINTS', () => {
    const { rerender } = render(<SignalEngineCard onExecuteSignal={() => {}} />);

    // Normal spread (18 <= 40)
    let button = screen.getByRole('button', { name: /EXECUTE SIGNAL/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);

    // Widen spread above MAX_SPREAD_POINTS
    act(() => {
      tradingEngine.spread = 45;
      (tradingEngine as any).invalidateTicker();
      (tradingEngine as any).emit('ticker');
    });

    rerender(<SignalEngineCard onExecuteSignal={() => {}} />);

    // Button must now be disabled by the spread gate
    button = screen.getByRole('button', { name: /SPREAD TOO WIDE/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

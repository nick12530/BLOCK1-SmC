import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PairsSignalDeck } from './PairsSignalDeck';
import { tradingEngine } from '../engine/tradingEngine';
import { SUPPORTED_SYMBOLS } from '../engine/instrumentConfig';

describe('PairsSignalDeck', () => {
  it('shows all supported pairs as unscanned when no fresh analyses exist', () => {
    tradingEngine.stopEngineLoops();

    render(
      <PairsSignalDeck
        scannerAnalyses={[]}
        activeSymbol="XAUUSD"
        onSelectSymbol={() => {}}
      />
    );

    expect(screen.getByText(`0 READY / ${SUPPORTED_SYMBOLS.length} PAIRS`)).toBeTruthy();
    for (const symbol of SUPPORTED_SYMBOLS) {
      expect(screen.getByText(`${symbol} · NO FRESH SCAN`)).toBeTruthy();
    }
  });
});

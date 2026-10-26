/**
 * useTradingStore.ts - React 18 useSyncExternalStore hooks for fine-grained channel subscriptions
 * Guarantees zero unnecessary re-renders across panels.
 */

import { useSyncExternalStore, useCallback } from 'react';
import { tradingEngine } from '../engine/tradingEngine';
import {
  TickerState,
  MarketState,
  PositionsState,
  EngineState,
  EventsState,
  ClosedTrade,
  JournalSignalRecord,
  JournalTradeRecord,
} from '../types/smc';
import { readSignalValidations, subscribeJournal } from '../engine/tradeJournal';
import type { SignalValidationRecord } from '../engine/signalValidation';
import type { PairAnalysis } from '../engine/multiPairScanner';
import type { SupportedSymbol } from '../engine/instrumentConfig';

export function useTicker(): TickerState {
  const subscribe = useCallback((cb: () => void) => tradingEngine.on('ticker', cb), []);
  const getSnapshot = useCallback(() => tradingEngine.getTickerSnapshot(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useMarket(): MarketState {
  const subscribe = useCallback((cb: () => void) => tradingEngine.on('market', cb), []);
  const getSnapshot = useCallback(() => tradingEngine.getMarketSnapshot(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function usePositions(): PositionsState {
  const subscribe = useCallback((cb: () => void) => tradingEngine.on('positions', cb), []);
  const getSnapshot = useCallback(() => tradingEngine.getPositionsSnapshot(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEngine(): EngineState {
  const subscribe = useCallback((cb: () => void) => tradingEngine.on('engine', cb), []);
  const getSnapshot = useCallback(() => tradingEngine.getEngineSnapshot(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEvents(): EventsState {
  const subscribe = useCallback((cb: () => void) => tradingEngine.on('events', cb), []);
  const getSnapshot = useCallback(() => tradingEngine.getEventsSnapshot(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useClosedTrades(): ClosedTrade[] {
  const subscribe = useCallback((cb: () => void) => tradingEngine.on('positions', cb), []);
  const getSnapshot = useCallback(() => tradingEngine.getClosedTradesSnapshot(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useScannerAnalyses(): PairAnalysis[] {
  const subscribe = useCallback((cb: () => void) => tradingEngine.on('scanner', cb), []);
  const getSnapshot = useCallback(() => tradingEngine.getScannerAnalyses(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useBestOpportunity(): PairAnalysis | null {
  const subscribe = useCallback((cb: () => void) => tradingEngine.on('scanner', cb), []);
  const getSnapshot = useCallback(() => tradingEngine.getBestOpportunity(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useActiveSymbol(): SupportedSymbol {
  const subscribe = useCallback((cb: () => void) => tradingEngine.on('ticker', cb), []);
  const getSnapshot = useCallback(() => tradingEngine.activeSymbol, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

let cachedSignalsRaw: string = '';
let cachedSignalsSnapshot: JournalSignalRecord[] = [];

export function useJournalSignals(): JournalSignalRecord[] {
  const subscribe = useCallback((cb: () => void) => {
    const unsubJournal = subscribeJournal(cb);
    const unsubEngine = tradingEngine.on('events', cb);
    return () => {
      unsubJournal();
      unsubEngine();
    };
  }, []);

  const getSnapshot = useCallback(() => {
    try {
      const stored = localStorage.getItem('smc.journal-signals.v1') || '[]';
      if (stored !== cachedSignalsRaw) {
        cachedSignalsRaw = stored;
        const parsed = JSON.parse(stored);
        cachedSignalsSnapshot = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // fallback
    }
    return cachedSignalsSnapshot;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

let cachedTradesRaw: string = '';
let cachedTradesSnapshot: JournalTradeRecord[] = [];

export function useJournalTrades(): JournalTradeRecord[] {
  const subscribe = useCallback((cb: () => void) => {
    const unsubJournal = subscribeJournal(cb);
    const unsubEngine = tradingEngine.on('positions', cb);
    return () => {
      unsubJournal();
      unsubEngine();
    };
  }, []);

  const getSnapshot = useCallback(() => {
    try {
      const stored = localStorage.getItem('smc.journal-trades.v1') || '[]';
      if (stored !== cachedTradesRaw) {
        cachedTradesRaw = stored;
        const parsed = JSON.parse(stored);
        cachedTradesSnapshot = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // fallback
    }
    return cachedTradesSnapshot;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

let cachedValidationsRaw = '';
let cachedValidationsSnapshot: SignalValidationRecord[] = [];

export function useSignalValidations(): SignalValidationRecord[] {
  const subscribe = useCallback((cb: () => void) => subscribeJournal(cb), []);
  const getSnapshot = useCallback(() => {
    try {
      const stored = localStorage.getItem('smc.signal-validation.v1') || '[]';
      if (stored !== cachedValidationsRaw) {
        cachedValidationsRaw = stored;
        cachedValidationsSnapshot = readSignalValidations();
      }
    } catch (error) {
      console.error('[Signal Validation] Could not read browser journal storage:', error);
    }
    return cachedValidationsSnapshot;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

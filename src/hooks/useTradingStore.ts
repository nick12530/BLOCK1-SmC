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
} from '../types/smc';

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

export function useScenario(): string {
  const subscribe = useCallback((cb: () => void) => tradingEngine.on('scenario', cb), []);
  const getSnapshot = useCallback(() => tradingEngine.getScenarioSnapshot(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useClosedTrades(): ClosedTrade[] {
  const subscribe = useCallback((cb: () => void) => tradingEngine.on('positions', cb), []);
  const getSnapshot = useCallback(() => tradingEngine.getClosedTradesSnapshot(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

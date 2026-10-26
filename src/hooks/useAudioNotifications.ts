/**
 * useAudioNotifications.ts - React hook for SMC Audio & System Sound Notifications
 * Listens for new signal candles, trade executions,
 * profits, losses, and updates reactive UI state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMarket, useTicker } from './useTradingStore';
import { signalAudioNotifier } from '../utils/audioNotification';
import { Signal } from '../types/smc';

export interface UseAudioNotificationsReturn {
  isMuted: boolean;
  toggleMute: () => void;
  playChime: () => void;
  playTradeChime: (direction?: 'BUY' | 'SELL') => void;
  playProfitChime: (profit?: number) => void;
  playLossChime: (loss?: number) => void;
  playTestSound: (type: 'signal' | 'trade' | 'precision' | 'profit' | 'loss') => void;
  lastAlertedSignal: Signal | null;
  hasNewAlert: boolean;
  clearAlert: () => void;
}

export function useAudioNotifications(): UseAudioNotificationsReturn {
  const market = useMarket();
  const ticker = useTicker();
  const [isMuted, setIsMuted] = useState(() => signalAudioNotifier.getMuted());
  const [lastAlertedSignal, setLastAlertedSignal] = useState<Signal | null>(null);
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const lastSignalKeyRef = useRef<string>('');

  const playChime = useCallback(() => {
    const signal = market.signal;
    if (signal) signalAudioNotifier.playSignalAlert(signal.direction, signal.entry);
  }, [market.signal]);

  const playTradeChime = useCallback((direction: 'BUY' | 'SELL' = 'BUY') => {
    signalAudioNotifier.playTradeExecutionAlert(direction);
  }, []);

  const playProfitChime = useCallback((profit: number = 25.0) => {
    signalAudioNotifier.playProfitAlert(profit);
  }, []);

  const playLossChime = useCallback((loss: number = -10.0) => {
    signalAudioNotifier.playLossAlert(loss);
  }, []);

  const playTestSound = useCallback((type: 'signal' | 'trade' | 'precision' | 'profit' | 'loss') => {
    signalAudioNotifier.playTestChime(type);
  }, []);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    signalAudioNotifier.setMuted(nextMuted);
    if (!nextMuted) {
      signalAudioNotifier.playTestChime('signal');
    }
  }, [isMuted]);

  const clearAlert = useCallback(() => {
    setHasNewAlert(false);
  }, []);

  // Monitor market signal transitions
  useEffect(() => {
    const sig = market.signal;
    if (!sig) return;
    const minScore = sig.score <= 10 ? 3.0 : 55;
    if (sig.score < minScore) return;

    const currentKey = `${ticker.symbol}_${sig.timeframe}_${sig.direction}_${sig.timestamp}`;
    if (currentKey !== lastSignalKeyRef.current) {
      lastSignalKeyRef.current = currentKey;
      setLastAlertedSignal(sig);
      setHasNewAlert(true);

      // Play professional signal chime
      signalAudioNotifier.unlock();
      signalAudioNotifier.playSignalAlert(sig.direction, sig.entry);

      // Reset alert badge after 8 seconds
      const timer = setTimeout(() => {
        setHasNewAlert(false);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [market.signal, ticker.symbol]);

  return {
    isMuted,
    toggleMute,
    playChime,
    playTradeChime,
    playProfitChime,
    playLossChime,
    playTestSound,
    lastAlertedSignal,
    hasNewAlert,
    clearAlert,
  };
}

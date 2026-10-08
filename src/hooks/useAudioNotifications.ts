/**
 * useAudioNotifications.ts - React hook for SMC Audio & System Sound Notifications
 * Listens for new high-confluence signals (score >= 4.0), trade executions,
 * profits, losses, and updates reactive UI state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMarket } from './useTradingStore';
import { signalAudioNotifier } from '../utils/audioNotification';
import { Signal } from '../types/smc';

export interface UseAudioNotificationsReturn {
  isMuted: boolean;
  toggleMute: () => void;
  playChime: () => void;
  playTradeChime: (direction?: 'BUY' | 'SELL') => void;
  playProfitChime: (profit?: number) => void;
  playLossChime: (loss?: number) => void;
  playTestSound: (type: 'signal' | 'trade' | 'profit' | 'loss') => void;
  lastAlertedSignal: Signal | null;
  hasNewAlert: boolean;
  clearAlert: () => void;
}

export function useAudioNotifications(): UseAudioNotificationsReturn {
  const market = useMarket();
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

  const playTestSound = useCallback((type: 'signal' | 'trade' | 'profit' | 'loss') => {
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
    if (!sig || sig.score < 4.0) return;

    const currentKey = `${sig.direction}_${sig.entry}_${sig.score}_${sig.timestamp}`;
    if (currentKey !== lastSignalKeyRef.current) {
      lastSignalKeyRef.current = currentKey;
      setLastAlertedSignal(sig);
      setHasNewAlert(true);

      // Play professional signal chime
      signalAudioNotifier.playSignalAlert(sig.direction, sig.entry);

      // Reset alert badge after 8 seconds
      const timer = setTimeout(() => {
        setHasNewAlert(false);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [market.signal]);

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

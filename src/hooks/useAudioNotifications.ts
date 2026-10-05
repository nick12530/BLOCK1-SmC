/**
 * useAudioNotifications.ts - React hook for SMC Signal Audio Notifications
 * Listens for new high-confluence signals (score >= 4.0) detected by tradingEngine,
 * triggers a subtle professional chime, and updates reactive UI state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMarket } from './useTradingStore';
import { signalAudioNotifier } from '../utils/audioNotification';
import { Signal } from '../types/smc';

export interface UseAudioNotificationsReturn {
  isMuted: boolean;
  toggleMute: () => void;
  playChime: () => void;
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

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    signalAudioNotifier.setMuted(nextMuted);
    if (!nextMuted) {
      signalAudioNotifier.playTestChime();
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

      // Play professional chime
      signalAudioNotifier.playSignalAlert();

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
    lastAlertedSignal,
    hasNewAlert,
    clearAlert,
  };
}

/**
 * MarketOpensTimer.tsx - Real-Time Interbank Market Sessions & Opens Countdown
 * High-visibility, institutional market timer displaying:
 * 1. Live ticking countdown to the next global market open
 * 2. 4 Global Forex Sessions (Sydney, Tokyo, London, New York) with live status
 * 3. Golden Overlap (London-NY) volatility tracker
 * 4. Audio verification controls (Test Signal sound & Test Execution sound)
 */

import React, { useState } from 'react';
import { useMarketOpenCountdown } from '../engine/marketHours';
import { signalAudioNotifier } from '../utils/audioNotification';
import {
  Clock,
  Globe,
  Zap,
  Volume2,
  VolumeX,
  ChevronDown,
  X,
  Play,
  Shield,
  Activity,
} from 'lucide-react';

interface MarketOpensTimerProps {
  compact?: boolean;
}

export const MarketOpensTimer: React.FC<MarketOpensTimerProps> = ({ compact = false }) => {
  const schedule = useMarketOpenCountdown();
  const [isOpenMatrix, setIsOpenMatrix] = useState(false);
  const [soundFeedback, setSoundFeedback] = useState<string | null>(null);

  const handleTestSound = (type: 'signal' | 'trade') => {
    signalAudioNotifier.unlock();
    if (type === 'signal') {
      signalAudioNotifier.playSignalAlert('BUY', 4188.5, false);
      setSoundFeedback('Played Signal Alert (Crystal Chime)');
    } else {
      signalAudioNotifier.playTradeExecutionAlert('BUY');
      setSoundFeedback('Played Trade Execution (Fill Click)');
    }
    setTimeout(() => setSoundFeedback(null), 2500);
  };

  const isMuted = signalAudioNotifier.getMuted();

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpenMatrix(!isOpenMatrix)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-mono transition-colors text-slate-700 dark:text-zinc-200 cursor-pointer shadow-2xs"
        title="View Market Open Countdown & Global Session Matrix"
      >
        <span className="relative flex h-2 w-2">
          {schedule.isOpen ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </>
          )}
        </span>

        <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />

        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold tracking-tight text-slate-900 dark:text-white">
            {schedule.isOpen ? (
              <span className="hidden sm:inline text-slate-500 dark:text-zinc-400">Next Open: </span>
            ) : (
              <span className="hidden sm:inline text-amber-600 dark:text-amber-400">Opens: </span>
            )}
            <strong className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">
              {schedule.nextMarketOpenName.replace(' Session Open', '').replace(' Open', '')} {schedule.nextMarketOpenCountdown}
            </strong>
          </span>
        </div>

        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpenMatrix ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Popover */}
      {isOpenMatrix && (
        <>
          <div
            className="fixed inset-0 z-100"
            onClick={() => setIsOpenMatrix(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-110 w-[340px] sm:w-[380px] bg-white dark:bg-[#0f141c] border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl p-4 font-mono text-xs text-slate-800 dark:text-zinc-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span className="font-bold text-slate-950 dark:text-white text-xs">
                  Global Market Schedule
                </span>
              </div>
              <button
                onClick={() => setIsOpenMatrix(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Next Open Banner */}
            <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
                  {schedule.isOpen ? 'Upcoming Session Open' : 'Market Reopen Countdown'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  {schedule.isOpen ? schedule.nextMarketOpenName : 'Interbank Gold'}
                </span>
              </div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-300 mt-1 flex items-center justify-between">
                <span>{schedule.nextMarketOpenCountdown}</span>
                <span className="text-[11px] font-normal text-slate-600 dark:text-zinc-400">
                  {schedule.isOpen ? 'Ticking Live' : schedule.reopenTimeFormatted.split('(')[0]}
                </span>
              </div>
            </div>

            {/* London-NY Overlap indicator */}
            {schedule.isOverlapActive && (
              <div className="mt-2.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
                <span>
                  <strong>London-New York Overlap ACTIVE</strong> · Peak volume & high volatility window.
                </span>
              </div>
            )}

            {/* Sessions Grid */}
            <div className="mt-3 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                Global Trading Sessions (UTC)
              </div>
              {schedule.sessions.map((sess) => (
                <div
                  key={sess.id}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                    sess.isOpen
                      ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/60 dark:border-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        sess.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-zinc-600'
                      }`}
                    />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {sess.name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-1.5">
                        {sess.hoursUtc}
                      </span>
                    </div>
                  </div>
                  <div>
                    {sess.isOpen ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        OPEN
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                        Opens in {sess.timeUntilOpen}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Sound & Execution Diagnostic Panel */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3 h-3 text-slate-400" />
                  Signal & Trade Audio Verification
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isMuted ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                  {isMuted ? 'Muted' : 'Audio Active'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleTestSound('signal')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Play className="w-3 h-3 text-emerald-500" />
                  Test Signal Sound
                </button>
                <button
                  onClick={() => handleTestSound('trade')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Zap className="w-3 h-3 text-sky-500" />
                  Test Trade Sound
                </button>
              </div>
              {soundFeedback && (
                <div className="mt-2 text-[10px] text-center text-emerald-600 dark:text-emerald-400 font-semibold animate-fade-in">
                  ✓ {soundFeedback}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

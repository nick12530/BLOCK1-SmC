/**
 * TerminalUtilitiesBar.tsx - Streamlined Executive Utilities Bar
 * De-cluttered: single-row horizontal strip with distinct active states:
 * - Essential kill switch and audio controls with sound previews
 */

import React, { useState } from 'react';
import { useEngine } from '../hooks/useTradingStore';
import { useAudioNotifications } from '../hooks/useAudioNotifications';
import {
  Volume2,
  VolumeX,
  AlertOctagon,
  Play,
} from 'lucide-react';

interface TerminalUtilitiesBarProps {
  onToggleKillSwitchPrompt: () => void;
}

type PreviewSound = 'signal' | 'trade' | 'precision' | 'profit' | 'loss';

export const TerminalUtilitiesBar: React.FC<TerminalUtilitiesBarProps> = React.memo(({
  onToggleKillSwitchPrompt,
}) => {
  const engine = useEngine();
  const { isMuted, toggleMute, hasNewAlert, playTestSound } = useAudioNotifications();
  const [previewSound, setPreviewSound] = useState<PreviewSound>('precision');

  const isKill = engine.kill_switch;

  return (
    <div className="neo-panel neo-card w-full border rounded-2xl p-4 sm:p-5 font-mono text-xs transition-colors flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
      {/* Essential safeguards and notification controls */}
      <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-full lg:items-center">
        {/* Emergency Kill Switch */}
        <button
          onClick={onToggleKillSwitchPrompt}
          aria-pressed={isKill}
          className={`min-h-11 min-w-0 whitespace-nowrap py-2 px-2.5 sm:px-3 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 ${
            isKill
              ? 'bg-rose-700 text-white border-rose-700'
              : 'neo-button bg-slate-50 hover:bg-rose-50 dark:bg-zinc-900 dark:hover:bg-rose-950/20 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
          title="Emergency circuit breaker"
        >
          <AlertOctagon className={`w-3.5 h-3.5 shrink-0 ${isKill ? 'text-white' : 'text-rose-500'}`} />
          <span className="font-bold text-xs">Kill Switch</span>
          <span className="text-[11px] font-black uppercase opacity-80">{isKill ? 'ARMED' : 'SAFE'}</span>
        </button>

        {/* Audio Chime */}
        <button
          onClick={toggleMute}
          aria-pressed={!isMuted}
          className={`col-span-2 min-h-11 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 lg:col-span-1 ${
            !isMuted
              ? 'bg-sky-600 text-white border-sky-600 dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500'
              : 'neo-button bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
          } disabled:cursor-not-allowed disabled:opacity-60`}
          title="Toggle audio alerts"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-zinc-500" />
          ) : (
            <Volume2 className="w-4 h-4 text-white" />
          )}
          <span className="font-bold text-xs">{isMuted ? 'Sound off' : 'Sound on'}</span>
          <span className={`h-2.5 w-2.5 rounded-full ${hasNewAlert ? 'bg-amber-400' : isMuted ? 'bg-slate-400' : 'bg-sky-200'}`} />
        </button>

        <div className="neo-inset col-span-2 flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-1 lg:max-w-xs">
          <label htmlFor="sound-preview" className="sr-only">Choose a sound to preview</label>
          <select
            id="sound-preview"
            value={previewSound}
            onChange={(event) => setPreviewSound(event.target.value as PreviewSound)}
            className="min-w-0 flex-1 bg-transparent px-1.5 py-2 text-xs font-bold text-slate-700 outline-none dark:text-zinc-200"
          >
            <option value="signal">Signal sound</option>
            <option value="precision">Precision sound</option>
            <option value="trade">Trade sound</option>
            <option value="profit">Profit sound</option>
            <option value="loss">Loss sound</option>
          </select>
          <button
            type="button"
            onClick={() => playTestSound(previewSound)}
            disabled={isMuted}
            className="flex min-h-9 shrink-0 items-center gap-1 rounded-md bg-slate-900 px-2.5 text-[11px] font-black uppercase text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            title="Preview selected notification sound"
          >
            <Play className="h-3 w-3 fill-current" />
            Test
          </button>
        </div>
      </div>

    </div>
  );
});

import React, { useEffect } from 'react';
import { X, Database, TrendingUp, TrendingDown, Minus, ArrowLeft } from 'lucide-react';
import { SCENARIOS } from '../engine/dataFeed';
import { tradingEngine } from '../engine/tradingEngine';

interface ReplayScenariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScenario: string;
}

export const ReplayScenariosModal: React.FC<ReplayScenariosModalProps> = ({
  isOpen,
  onClose,
  currentScenario,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectScenario = (id: string) => {
    tradingEngine.resetWithScenario(id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="replay-scenarios-title"
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#111723] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-blue-500" />
            <div>
              <h2 id="replay-scenarios-title" className="text-base font-bold text-slate-900 dark:text-white">Market Regimes & Replay</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Test background SMC confluence detection against historical gold patterns
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Scenarios */}
        <div className="p-6 space-y-3">
          {SCENARIOS.map((sc) => {
            const isSelected = currentScenario === sc.id;
            return (
              <div
                key={sc.id}
                onClick={() => handleSelectScenario(sc.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-[#0c1017] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{sc.name}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                          sc.targetBias === 'bullish'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : sc.targetBias === 'bearish'
                            ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {sc.targetBias.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{sc.description}</p>
                  </div>

                  <div className="shrink-0 flex items-center gap-1 font-mono text-xs">
                    {sc.expectedSignal === 'BUY' && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                        <TrendingUp className="w-3.5 h-3.5" /> BUY
                      </span>
                    )}
                    {sc.expectedSignal === 'SELL' && (
                      <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-0.5">
                        <TrendingDown className="w-3.5 h-3.5" /> SELL
                      </span>
                    )}
                    {sc.expectedSignal === 'NONE' && (
                      <span className="text-slate-400 font-bold flex items-center gap-0.5">
                        <Minus className="w-3.5 h-3.5" /> NO TRADE
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Terminal</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Sliders, Shield, AlertTriangle, ArrowLeft } from 'lucide-react';
import { TerminalSnapshot } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';
import { RISK_CONFIG } from '../engine/riskConfig';

interface RiskSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: TerminalSnapshot;
}

export const RiskSettingsModal: React.FC<RiskSettingsModalProps> = ({
  isOpen,
  onClose,
  snapshot,
}) => {
  const [balanceInput, setBalanceInput] = useState<number>(snapshot.balance);
  const [autoRr, setAutoRr] = useState<number>(tradingEngine.account.auto_rr);
  const [minScore, setMinScore] = useState<number>(tradingEngine.minScoreThreshold || 75);
  const [allowOverride, setAllowOverride] = useState<boolean>(tradingEngine.allowHighConfluenceOverride ?? true);
  const [autoSelectBest, setAutoSelectBest] = useState<boolean>(tradingEngine.autoSelectBestScenario ?? true);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    tradingEngine.account.max_daily_loss_pct = RISK_CONFIG.maxDailyLossPercent;
    tradingEngine.account.risk_pct = RISK_CONFIG.riskPercentPerTrade;
    tradingEngine.account.auto_rr = autoRr;
    tradingEngine.setMinScoreThreshold(minScore);
    tradingEngine.setAllowHighConfluenceOverride(allowOverride);
    tradingEngine.setAutoSelectBestScenario(autoSelectBest);
    if (!tradingEngine.mt5Account.connected) {
      tradingEngine.account.balance = balanceInput;
      tradingEngine.account.equity = balanceInput;
      tradingEngine.account.daily_start_balance = balanceInput;
    }
    tradingEngine.slog(`Risk parameters updated: Score threshold ${minScore}/100, Fallback Override: ${allowOverride ? 'ON' : 'OFF'}, Auto-Select Setup: ${autoSelectBest ? 'ON' : 'OFF'}`, 'info');
    tradingEngine.notify();
    onClose();
  };

  const setPresetBalance = (val: number) => {
    setBalanceInput(val);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-settings-title"
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col my-auto font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-emerald-500" />
            <div>
              <h2 id="risk-settings-title" className="text-sm sm:text-base font-bold text-zinc-950 dark:text-white">Risk & Drawdown Rules</h2>
              <p className="text-[11px] text-zinc-500">Capital preservation rules & drawdown limits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable on mobile */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Account Balance Presets */}
          <div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400 mb-1.5">
              <span>{tradingEngine.mt5Account.connected ? 'Broker Equity (read only)' : 'Simulation Balance ($ USD)'}</span>
              <span className="text-slate-900 dark:text-white font-semibold">${snapshot.equity.toLocaleString()}</span>
            </div>
            <input
              type="number"
              step="1000"
              value={balanceInput}
              onChange={(e) => setBalanceInput(Number(e.target.value))}
              disabled={tradingEngine.mt5Account.connected}
              className="w-full bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-blue-500"
            />
            {!tradingEngine.mt5Account.connected && (
              <div className="grid grid-cols-6 gap-1.5 mt-2">
                {[10, 25, 50, 100, 500, 1000].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setPresetBalance(b)}
                    className={`py-1.5 rounded-lg border text-[10px] font-semibold transition-colors cursor-pointer ${
                      balanceInput === b
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    ${b}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Confluence Score Execution Threshold */}
          <div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span>Minimum Confluence Score Threshold</span>
              <span className="text-sky-600 dark:text-sky-400 font-bold font-mono">{minScore} / 100</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono mt-1">
              <span>50 (Moderate)</span>
              <span>75 (Institutional Default)</span>
              <span>95 (Ultra-Strict)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
              <div className="text-[10px] uppercase text-slate-500 dark:text-zinc-400">Max daily loss</div>
              <div className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-300">{RISK_CONFIG.maxDailyLossPercent}%</div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="text-[10px] uppercase text-slate-500 dark:text-zinc-400">Max risk per order</div>
              <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-300">{RISK_CONFIG.riskPercentPerTrade}%</div>
            </div>
          </div>

          {/* Small Account Protection Rules Summary */}
          <div className="bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 p-3 rounded-xl space-y-1.5 text-[11px] text-slate-700 dark:text-zinc-300 font-sans">
            <div className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
              <span>Small Account ($10) Safety Engine</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-600 dark:text-zinc-400">
              <li>Max simultaneous open trades: 1</li>
              <li>Daily limit: 5 trades max / day (3 trades max / pair)</li>
              <li>Rejects micro-lot if risk exceeds budget: <code>TRADE_REJECTED: MINIMUM_LOT_EXCEEDS_RISK</code></li>
              <li>Zero Martingale, zero averaging, and USD correlation exposure protection enabled</li>
            </ul>
          </div>

          {/* High-Confluence Fallback Override Toggle */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="space-y-0.5 pr-2">
              <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>High-Quality Fallback Override</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 font-mono font-bold">PRIME</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-sans">
                Automatically take trades on prime signals (Score ≥ 70) even if daily limit (5/day) has been reached. Never miss an exceptional setup.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allowOverride}
              onClick={() => setAllowOverride(!allowOverride)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                allowOverride ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  allowOverride ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto-Select Best Opportunity Toggle */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="space-y-0.5 pr-2">
              <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Auto-Focus Best Setup in Chart</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 font-mono font-bold">#1 SYNC</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-sans">
                When multi-pair scanner finds a top-ranked opportunity, automatically switch the chart symbol to it.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoSelectBest}
              onClick={() => setAutoSelectBest(!autoSelectBest)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                autoSelectBest ? 'bg-sky-600' : 'bg-slate-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  autoSelectBest ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto R:R Target */}
          <div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span>Target Risk:Reward Ratio</span>
              <span className="text-slate-900 dark:text-white font-semibold">1 : {autoRr}</span>
            </div>
            <input
              type="number"
              step="0.5"
              min="1.0"
              max="5.0"
              value={autoRr}
              onChange={(e) => setAutoRr(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Prop Firm Safeguard Notice */}
          <div className="bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Risk controls come from <code>risk-config.json</code>. If the configured news windows are not a fit, review them before enabling live automation; these time windows are not a substitute for a live economic calendar.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Terminal</span>
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 text-white dark:bg-white dark:text-black transition-colors cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

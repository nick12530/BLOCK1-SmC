import React, { useState, useEffect } from 'react';
import { X, Sliders, Shield, AlertTriangle, ArrowLeft } from 'lucide-react';
import { TerminalSnapshot } from '../types/smc';
import { tradingEngine } from '../engine/tradingEngine';

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
  const [maxDailyLoss, setMaxDailyLoss] = useState<number>(
    tradingEngine.account.max_daily_loss_pct
  );
  const [riskPct, setRiskPct] = useState<number>(tradingEngine.account.risk_pct);
  const [autoRr, setAutoRr] = useState<number>(tradingEngine.account.auto_rr);

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
    tradingEngine.account.balance = balanceInput;
    tradingEngine.account.equity = balanceInput;
    tradingEngine.account.daily_start_balance = balanceInput;
    tradingEngine.account.max_daily_loss_pct = maxDailyLoss;
    tradingEngine.account.risk_pct = riskPct;
    tradingEngine.account.auto_rr = autoRr;
    tradingEngine.account.daily_loss_hit = false;
    tradingEngine.slog(`Risk parameters updated: Balance $${balanceInput}, Max DD ${maxDailyLoss}%, Risk ${riskPct}%`, 'info');
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
              <span>Account Balance ($ USD)</span>
              <span className="text-slate-900 dark:text-white font-semibold">${balanceInput.toLocaleString()}</span>
            </div>
            <input
              type="number"
              step="1000"
              value={balanceInput}
              onChange={(e) => setBalanceInput(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-[#0c1017] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-blue-500"
            />
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[10000, 25000, 50000, 100000].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setPresetBalance(b)}
                  className={`py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                    balanceInput === b
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  ${(b / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>

          {/* Max Daily Drawdown % */}
          <div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span>Max Daily Drawdown Kill-Switch (%)</span>
              <span className="text-red-500 font-semibold">{maxDailyLoss}%</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.5"
              value={maxDailyLoss}
              onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
              className="w-full accent-red-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>1.0% (Strict)</span>
              <span>3.0% (Default)</span>
              <span>5.0% (Prop Firm Limit)</span>
            </div>
          </div>

          {/* Risk per trade % */}
          <div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span>Risk Per Signal Trade (%)</span>
              <span className="text-emerald-500 font-semibold">{riskPct}%</span>
            </div>
            <input
              type="range"
              min="0.25"
              max="3.0"
              step="0.25"
              value={riskPct}
              onChange={(e) => setRiskPct(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
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
              If daily equity falls by <strong className="text-slate-900 dark:text-white">{maxDailyLoss}%</strong>, the engine locks all trading until the next trading day.
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

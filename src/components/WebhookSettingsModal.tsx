/**
 * WebhookSettingsModal.tsx - Telegram & External Webhook Alert Configuration
 *
 * Provides real-time setup and testing for:
 * - Telegram Instant Push Alerts (@BotFather bot token + chat ID)
 * - Discord / Custom Webhook integration
 * - Confluence filters & execution notifications
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Send,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  getWebhookConfig,
  saveWebhookConfig,
  sendTelegramMessage,
  sendCustomWebhook,
  WebhookConfig,
} from '../utils/webhookNotifier';

interface WebhookSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WebhookSettingsModal: React.FC<WebhookSettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<WebhookConfig>(getWebhookConfig());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getWebhookConfig());
      setTestResult(null);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveWebhookConfig(config);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleTestNotification = async () => {
    setTesting(true);
    setTestResult(null);

    const testTime = new Date().toLocaleTimeString();
    const testHtml = `
⚡ <b>NIFTY TERMINAL TEST ALERT</b> ⚡
━━━━━━━━━━━━━━━━━━
<b>Status:</b> Telegram webhook linked successfully!
<b>Signal Channel:</b> M15/M5 Institutional Sniper
<b>Time:</b> ${testTime}
━━━━━━━━━━━━━━━━━━
<i>Ready to receive real-time sniper trade signals!</i>
`.trim();

    try {
      if (config.type === 'telegram' || config.type === 'both') {
        if (!config.telegramBotToken || !config.telegramChatId) {
          throw new Error('Please enter both Telegram Bot Token and Chat ID before testing.');
        }
        const res = await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, testHtml);
        if (!res.ok) {
          throw new Error(res.error || 'Failed to dispatch test Telegram message.');
        }
      }

      if (config.type === 'webhook' || config.type === 'both') {
        if (!config.webhookUrl) {
          throw new Error('Please enter a Webhook URL before testing.');
        }
        const res = await sendCustomWebhook(config.webhookUrl, {
          event: 'TEST_ALERT',
          message: 'NIFTY Terminal webhook verified successfully.',
          timestamp: new Date().toISOString(),
        });
        if (!res.ok) {
          throw new Error(res.error || 'Failed to dispatch test Webhook payload.');
        }
      }

      setTestResult({
        ok: true,
        msg: '✅ Test alert delivered successfully! Check your Telegram / Webhook channel.',
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        msg: err?.message || 'Failed to dispatch test alert.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[170] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs font-mono text-xs select-none animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xl max-h-[92dvh] rounded-2xl bg-white dark:bg-[#0c0e12] border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-zinc-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/80 dark:bg-[#12151b] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                External Alerts &amp; Telegram Push
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Receive instant mobile alerts for M15/M5 sniper setups across all pairs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75dvh]">
          {/* Master Enable Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Enable Instant Push Alerts</span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Dispatches alerts directly to your phone when confirmed sniper signals appear
              </p>
            </div>

            <button
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                config.enabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  config.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Alert Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
              Alert Destination
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['telegram', 'webhook', 'both'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, type: t }))}
                  className={`p-2.5 rounded-xl border text-center font-bold capitalize transition-all cursor-pointer ${
                    config.type === t
                      ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {t === 'both' ? 'Telegram & Webhook' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Telegram Settings Section */}
          {(config.type === 'telegram' || config.type === 'both') && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#12151c] border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                <span className="font-extrabold text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  <span>Telegram Bot Credentials</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">Direct HTTP Bot API</span>
              </div>

              {/* Bot Token */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                    Bot API Token:
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                    From @BotFather
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 7123456789:AAHk..."
                  value={config.telegramBotToken}
                  onChange={(e) => setConfig((prev) => ({ ...prev, telegramBotToken: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 font-mono text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Chat ID */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                    Your Telegram Chat ID:
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                    From @userinfobot
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 123456789 or -100123456789"
                  value={config.telegramChatId}
                  onChange={(e) => setConfig((prev) => ({ ...prev, telegramChatId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 font-mono text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Instructions Mini-Guide */}
              <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-800 dark:text-sky-300 space-y-1">
                <span className="font-bold block">Quick 2-Minute Setup:</span>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-600 dark:text-zinc-300">
                  <li>Open Telegram and message <b>@BotFather</b> with <code>/newbot</code> to get your token.</li>
                  <li>Click Start on your new bot.</li>
                  <li>Message <b>@userinfobot</b> on Telegram to get your numerical <b>Chat ID</b>.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Custom Webhook Settings Section */}
          {(config.type === 'webhook' || config.type === 'both') && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#12151c] border border-slate-200 dark:border-zinc-800 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider block">
                Generic Webhook / Discord Endpoint URL
              </label>
              <input
                type="url"
                placeholder="https://discord.com/api/webhooks/... or https://your-server.com/api/alert"
                value={config.webhookUrl}
                onChange={(e) => setConfig((prev) => ({ ...prev, webhookUrl: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 font-mono text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Notification Criteria Filters */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 space-y-3">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-zinc-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-500" />
              <span>Filter Sensitivity &amp; Rules</span>
            </span>

            <div className="space-y-2 text-[11px]">
              <label className="flex items-center justify-between cursor-pointer">
                <span>Only Verified Sniper POI Setups:</span>
                <input
                  type="checkbox"
                  checked={config.onlySniperSignals}
                  onChange={(e) => setConfig((prev) => ({ ...prev, onlySniperSignals: e.target.checked }))}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-400"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>Notify On Order Fill Executions:</span>
                <input
                  type="checkbox"
                  checked={config.alertOnExecutions}
                  onChange={(e) => setConfig((prev) => ({ ...prev, alertOnExecutions: e.target.checked }))}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-400"
                />
              </label>

              <div className="flex items-center justify-between pt-1">
                <span>Minimum Confluence Score:</span>
                <span className="font-bold text-amber-500">{config.minConfluenceScore} / 100</span>
              </div>
              <input
                type="range"
                min="50"
                max="90"
                step="5"
                value={config.minConfluenceScore}
                onChange={(e) => setConfig((prev) => ({ ...prev, minConfluenceScore: Number(e.target.value) }))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              )}
              <span className="font-bold">{testResult.msg}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center">
              ✓ Alert configuration saved successfully!
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-[#12151b] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={testing}
            onClick={handleTestNotification}
            className="px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{testing ? 'Sending Test...' : 'Send Test Alert'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

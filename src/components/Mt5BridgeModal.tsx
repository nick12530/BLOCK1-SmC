import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Server, X, Activity, Wifi, Shield, RefreshCw } from 'lucide-react';
import { getDefaultServerUrl, mt5Bridge, normalizeTailscaleUrl } from '../engine/mt5Bridge';
import { tradingEngine } from '../engine/tradingEngine';
import { useMarket } from '../hooks/useTradingStore';
import type { InstrumentType } from '../types/smc';

interface Mt5BridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SETUP_COMMAND = 'powershell -ExecutionPolicy Bypass -File .\\mt5-bridge\\start_phone_link.ps1';

export const Mt5BridgeModal: React.FC<Mt5BridgeModalProps> = ({ isOpen, onClose }) => {
  const [symbol, setSymbol] = useState('XAUUSD');
  const [instrumentType, setInstrumentType] = useState<InstrumentType>('standard');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('smc_tailscale_url') || localStorage.getItem('smc_mt5_base_url') || getDefaultServerUrl();
    }
    return getDefaultServerUrl();
  });
  const [pingState, setPingState] = useState<{ testing: boolean; ok?: boolean; latencyMs?: number; error?: string } | null>(null);

  const market = useMarket();
  const [connectionRefresh, setConnectionRefresh] = useState(0);
  const bridgeStatus = mt5Bridge.getStatus();
  const isConnected = bridgeStatus.connected;
  const isReconnecting = bridgeStatus.isReconnecting;
  const accountMode = market.accountMode ?? bridgeStatus.mode;

  useEffect(() => {
    const timer = window.setInterval(() => setConnectionRefresh((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePing = async () => {
    setPingState({ testing: true });
    const res = await mt5Bridge.ping(bridgeUrl);
    setPingState({ testing: false, ...res });
  };

  const handleConnect = async () => {
    if (!symbol.trim()) {
      setStatus('error');
      setMessage('Enter the exact gold symbol shown in your MT5 Market Watch.');
      return;
    }

    setStatus('connecting');
    setMessage('');
    try {
      const targetUrl = normalizeTailscaleUrl(bridgeUrl || getDefaultServerUrl());
      const snapshot = await mt5Bridge.connectAccount({
        baseUrl: targetUrl,
        symbol: symbol.trim(),
        instrumentType,
      });
      tradingEngine.linkMt5Account(
        String(snapshot.account.login),
        snapshot.account.server,
        snapshot.account.balance,
        snapshot.account.equity
      );
      setStatus('connected');
      const isTailscale = targetUrl.includes('100.') || targetUrl.includes('.ts.net');
      setMessage(
        `Connected to ${snapshot.accountMode.toUpperCase()} account ${snapshot.account.login} on ${snapshot.account.server}${
          isTailscale ? ' via Tailscale Private Mesh' : ''
        }.`
      );
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to connect to the MT5 bridge.');
    }
  };

  const handleDisconnect = async () => {
    await mt5Bridge.disconnectAccount();
    tradingEngine.unlinkMt5Account();
    setStatus('idle');
    setMessage('Dashboard disconnected. MT5 Desktop remains logged in.');
  };

  const handleCopySetup = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_COMMAND);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Could not copy the setup command.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mt5-bridge-title"
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-6"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#101216]">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-slate-200 p-2 dark:border-zinc-700">
              <Server className="h-4 w-4 text-slate-600 dark:text-zinc-300" />
            </div>
            <div>
              <h2 id="mt5-bridge-title" className="text-base font-semibold text-slate-950 dark:text-white">
                Connect MetaTrader 5
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                Private phone link · credentials stay in MT5 Desktop
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close MT5 bridge"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[calc(92vh-72px)] space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className={`flex items-start gap-3 rounded-xl border p-4 ${
            isConnected
              ? 'border-emerald-700/20 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300'
          }`}>
            {isConnected ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : isReconnecting ? (
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-500" />
            ) : (
              <Server className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="text-sm leading-relaxed flex-1">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <strong className="font-semibold">
                  {isConnected
                    ? isReconnecting
                      ? 'MT5 Reconnecting (Transient Packet Retry…)'
                      : 'MT5 connected'
                    : 'MT5 not connected'}
                </strong>
                {isConnected && bridgeStatus.latencyMs && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                    ⚡ {bridgeStatus.latencyMs}ms {bridgeStatus.isTailscale ? 'Tailscale' : 'LAN'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs opacity-80 font-mono">
                {isConnected
                  ? `${String(accountMode).toUpperCase()} account ${tradingEngine.mt5Account.login} on ${tradingEngine.mt5Account.server}. Positions and quotes sync through this shared MT5 bridge.`
                  : mt5Bridge.getStatus().lastError || 'MT5 Desktop must be open and logged into the account you want to use.'}
              </p>
            </div>
          </div>

          {/* Tailscale & Remote Bridge Endpoint Configuration */}
          <section className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-sky-500" />
                <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Tailscale / Remote Mobile Bridge Address
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono font-bold border border-sky-500/20">
                Private Mesh
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              When running on your mobile phone via Tailscale VPN, enter your Windows PC’s Tailscale address (e.g. <code>http://100.x.y.z:8000</code>) or MagicDNS domain:
            </p>

            <div className="flex items-center gap-2">
              <input
                value={bridgeUrl}
                onChange={(e) => setBridgeUrl(e.target.value)}
                disabled={isConnected}
                placeholder="http://100.85.120.45:8000 or http://127.0.0.1:8000"
                className="flex-1 min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-950 outline-none transition-colors focus:border-slate-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
              <button
                type="button"
                onClick={handlePing}
                disabled={pingState?.testing}
                className="shrink-0 px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold font-mono transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {pingState?.testing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Activity className="h-3.5 w-3.5 text-sky-500" />
                )}
                <span>{pingState?.testing ? 'Testing…' : 'Ping Link'}</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono">
              <span className="text-slate-400">Presets:</span>
              <button
                type="button"
                onClick={() => setBridgeUrl('http://127.0.0.1:8000')}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Localhost (PC)
              </button>
              <button
                type="button"
                onClick={() => setBridgeUrl(`${window.location.origin}/mt5-bridge`)}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Web Proxy (/mt5-bridge)
              </button>
            </div>

            {/* Ping Feedback Badge */}
            {pingState && !pingState.testing && (
              <div
                className={`p-2.5 rounded-lg text-xs font-mono flex items-center justify-between border ${
                  pingState.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                <span>
                  {pingState.ok
                    ? `✓ Tailscale Bridge online! Latency: ${pingState.latencyMs}ms`
                    : `✗ Reachability test failed: ${pingState.error}`}
                </span>
                {pingState.ok && (
                  <span className="text-[10px] font-bold uppercase">
                    {pingState.latencyMs! < 60 ? 'Direct P2P' : 'DERP Relay'}
                  </span>
                )}
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">1 · Sign in</p>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-zinc-100">Use MT5 Desktop</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                Log in on the Windows PC. The dashboard never asks for or receives your trading password.
              </p>
            </div>
            <div className="hidden items-center text-slate-300 dark:text-zinc-700 sm:flex" aria-hidden="true">→</div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">2 · Start once</p>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-zinc-100">Run the private-link launcher</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                Install Tailscale on the PC and phone and sign into the same private network. Run this from the project folder in Windows PowerShell.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                <code className="min-w-0 flex-1 break-all text-[10px] leading-relaxed text-slate-700 dark:text-zinc-300">
                  {SETUP_COMMAND}
                </code>
                <button
                  onClick={() => void handleCopySetup()}
                  aria-label="Copy MT5 setup command"
                  className="shrink-0 rounded-md border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </section>

          <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            Keep the launcher windows open. It starts the dashboard, local bridge, and Tailscale Serve, then prints a private HTTPS address. Open that address on your phone with Tailscale connected. Never enable Funnel or expose port 8000.
          </p>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
              To switch between demo and live, first disconnect the dashboard, change the account in MT5 Desktop, then reconnect here. The account type and login are read from the broker; selecting a dashboard label never changes the trading account. If the terminal account changes while connected, order submission is paused until you reconnect.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
            <label className="block text-sm font-medium text-slate-900 dark:text-zinc-100">
              Instrument type
              <select
                value={instrumentType}
                onChange={(event) => setInstrumentType(event.target.value as InstrumentType)}
                disabled={isConnected}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              >
                <option value="standard">Standard CFD / FX / metals / indices</option>
                <option value="synthetic">Synthetic volatility index</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-900 dark:text-zinc-100">
              Exact broker symbol
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                disabled={isConnected}
                placeholder="XAUUSD, EURUSD, Volatility 75 Index"
                autoComplete="off"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-950 outline-none transition-colors focus:border-slate-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-400"
              />
            </label>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-500">
              Use the exact symbol name from MT5 Market Watch. No account password or bridge token is entered here.
            </p>
          </section>

          {message && (
            <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
              status === 'error'
                ? 'border-rose-700/20 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200'
                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
            }`}>
              {status === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{message}</span>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
            {isConnected && (
              <button
                onClick={() => void handleDisconnect()}
                className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Disconnect dashboard
              </button>
            )}
            <button
              onClick={() => void handleConnect()}
              disabled={status === 'connecting' || isConnected}
              className="min-h-11 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              {status === 'connecting' ? 'Connecting…' : isConnected ? 'MT5 Connected' : 'Connect to open MT5 account'}
            </button>
          </div>
          <p className="text-center text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500">
            Test on a demo account first. Live trading involves risk; a connected bridge can send real orders.
          </p>
          <span className="sr-only" aria-live="polite">{connectionRefresh}</span>
        </div>
      </div>
    </div>
  );
};

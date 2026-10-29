import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Server, X, Activity, Shield, RefreshCw } from 'lucide-react';
import { getDefaultServerUrl, mt5Bridge } from '../engine/mt5Bridge';
import { tradingEngine } from '../engine/tradingEngine';
import { useMarket } from '../hooks/useTradingStore';
import type { InstrumentType } from '../types/smc';

interface Mt5BridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SETUP_COMMAND = 'powershell -ExecutionPolicy Bypass -File .\\mt5-bridge\\start_pc.ps1';

export const Mt5BridgeModal: React.FC<Mt5BridgeModalProps> = ({ isOpen, onClose }) => {
  const [symbol, setSymbol] = useState('XAUUSD');
  const [instrumentType, setInstrumentType] = useState<InstrumentType>('standard');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [pingState, setPingState] = useState<{ testing: boolean; ok?: boolean; latencyMs?: number; error?: string } | null>(null);
  const [token, setToken] = useState(() => mt5Bridge.getBridgeToken());
  const [showTokenField, setShowTokenField] = useState(() => Boolean(mt5Bridge.getBridgeToken()));

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
    if (token) mt5Bridge.setBridgeToken(token.trim());
    const res = await mt5Bridge.ping();
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
      const targetUrl = getDefaultServerUrl();
      const snapshot = await mt5Bridge.connectAccount({
        baseUrl: targetUrl,
        symbol: symbol.trim(),
        instrumentType,
        token: token.trim(),
      });
      tradingEngine.linkMt5Account(
        String(snapshot.account.login),
        snapshot.account.server,
        snapshot.account.balance,
        snapshot.account.equity
      );
      setStatus('connected');
      setMessage(`Connected to ${snapshot.accountMode.toUpperCase()} account ${snapshot.account.login} on ${snapshot.account.server}.`);
    } catch (error) {
      setStatus('error');
      const errText = error instanceof Error ? error.message : 'Unable to connect to the MT5 bridge.';
      if (errText.includes('401') || errText.toLowerCase().includes('token')) {
        setShowTokenField(true);
      }
      setMessage(errText);
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
                Local PC bridge · credentials stay in MT5 Desktop
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
                    ⚡ {bridgeStatus.latencyMs}ms local
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

          {/* Local bridge status and reachability */}
          <section className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-sky-500" />
                <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  MT5 bridge on this PC
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono font-bold border border-sky-500/20">
                Local only
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              The dashboard connects only to <code>{getDefaultServerUrl()}</code>. Run the bridge and dashboard on the same Windows PC.
            </p>

            <div className="flex items-center justify-between gap-3">
              <code className="font-mono text-xs text-slate-700 dark:text-zinc-300">{getDefaultServerUrl()}</code>
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
                <span>{pingState?.testing ? 'Testing…' : 'Test local bridge'}</span>
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
                    ? `✓ Local bridge online! Latency: ${pingState.latencyMs}ms`
                    : `✗ Reachability test failed: ${pingState.error}`}
                </span>
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
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-zinc-100">Start the PC workspace</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                Run this command from the project folder in Windows PowerShell. It starts the local MT5 bridge and optimized dashboard.
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
            Keep both PowerShell windows open while using the dashboard. The bridge binds to this PC only and is not exposed to other devices.
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
              Use the exact symbol name from MT5 Market Watch.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 block">
                  Daily-Loss Circuit Breaker
                </span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {mt5Bridge.getCircuitBreakerEnabled()
                    ? 'Active · Protects account by locking order submission at 3% max daily loss'
                    : 'Bypassed · Daily-loss and consecutive-loss protections are turned OFF'}
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const curr = mt5Bridge.getCircuitBreakerEnabled();
                  await tradingEngine.toggleCircuitBreaker(!curr);
                  setConnectionRefresh((v) => v + 1);
                }}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer border ${
                  mt5Bridge.getCircuitBreakerEnabled()
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500 text-black border-amber-600 font-extrabold shadow-sm'
                }`}
              >
                {mt5Bridge.getCircuitBreakerEnabled() ? 'ENABLED (ON)' : 'DISABLED (OFF)'}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Bridge Security Token (Optional on localhost)
              </span>
              <button
                type="button"
                onClick={() => setShowTokenField((prev) => !prev)}
                className="text-[11px] font-mono text-sky-500 hover:underline cursor-pointer"
              >
                {showTokenField ? 'Hide token field' : 'Configure token'}
              </button>
            </div>
            {showTokenField && (
              <div className="space-y-1.5 pt-1">
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste token from bridge_token.txt if running remotely"
                  autoComplete="off"
                  disabled={isConnected}
                  className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-950 outline-none transition-colors focus:border-slate-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-400"
                />
                <p className="text-[10px] text-slate-500 dark:text-zinc-500 leading-relaxed">
                  Local requests on 127.0.0.1 connect automatically without a token. If strict auth is enabled or connecting from another device, paste the token saved in <code className="text-[10px]">AppData\Local\SMCBridge\bridge_token.txt</code>.
                </p>
              </div>
            )}
          </section>

          {message && (
            <div className={`space-y-2 rounded-lg border p-3 text-sm ${
              status === 'error'
                ? 'border-rose-700/20 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200'
                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
            }`}>
              <div className="flex items-start gap-2">
                {status === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                <span className="flex-1 break-words">{message}</span>
              </div>
              {status === 'error' && (message.includes('401') || message.toLowerCase().includes('token')) && (
                <div className="mt-2 pt-2 border-t border-rose-200/50 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 space-y-1.5">
                  <p className="font-medium">To resolve:</p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                    <li>Close the existing Python bridge PowerShell window to stop the outdated process.</li>
                    <li>Re-run the launcher to restart with clean token synchronization: <code className="font-mono bg-rose-100 dark:bg-rose-950 px-1 py-0.5 rounded text-[10px]">powershell -ExecutionPolicy Bypass -File .\mt5-bridge\start_pc.ps1 -RestartBridge</code></li>
                    <li>Alternatively, open <code className="font-mono bg-rose-100 dark:bg-rose-950 px-1 py-0.5 rounded text-[10px]">bridge_token.txt</code> from the path in the error message and paste the token into the field above.</li>
                  </ol>
                </div>
              )}
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

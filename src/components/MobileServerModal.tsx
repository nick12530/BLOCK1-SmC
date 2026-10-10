/**
 * MobileServerModal.tsx - Comprehensive Mobile Web App (PWA) & Phone Server Hub
 * Enables the user to:
 * 1. Install & run the system as an independent standalone mobile web app (PWA) on iPhone & Android.
 * 2. Run the Node.js server directly on their phone using Termux (Android) or iSH (iOS).
 * 3. Connect to a local server over Wi-Fi from any mobile device.
 * 4. Understand how the system functions 100% client-side with local storage and real-time SMC calculations.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Server,
  Terminal,
  Wifi,
  Copy,
  Check,
  Download,
  Share2,
  ExternalLink,
  ShieldCheck,
  Zap,
  HardDrive,
  RefreshCw,
  Cpu,
  Layers,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { tradingEngine } from '../engine/tradingEngine';
import { useEngine, useMarket } from '../hooks/useTradingStore';
import { mt5Bridge, normalizeTailscaleUrl } from '../engine/mt5Bridge';

interface MobileServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModeTab = 'standalone_pwa' | 'android_termux' | 'ios_ish' | 'wifi_lan' | 'features';

export const MobileServerModal: React.FC<MobileServerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<ModeTab>('standalone_pwa');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [customIp, setCustomIp] = useState('192.168.1.100');
  const [tailscaleAddress, setTailscaleAddress] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('smc_tailscale_url') || 'http://100.85.120.45:8000';
    }
    return 'http://100.85.120.45:8000';
  });
  const [tailscalePing, setTailscalePing] = useState<{ testing: boolean; ok?: boolean; latencyMs?: number; error?: string } | null>(null);
  const [connectingTailscale, setConnectingTailscale] = useState(false);
  const [tailscaleMsg, setTailscaleMsg] = useState<string | null>(null);

  const engine = useEngine();
  const market = useMarket();
  const bridgeStatus = mt5Bridge.getStatus();

  const handleTestTailscale = async () => {
    setTailscalePing({ testing: true });
    setTailscaleMsg(null);
    const res = await mt5Bridge.ping(tailscaleAddress);
    setTailscalePing({ testing: false, ...res });
  };

  const handleConnectTailscale = async () => {
    setConnectingTailscale(true);
    setTailscaleMsg(null);
    try {
      const url = normalizeTailscaleUrl(tailscaleAddress);
      const snapshot = await mt5Bridge.connectAccount({
        baseUrl: url,
        symbol: 'XAUUSD',
        instrumentType: 'standard',
      });
      tradingEngine.linkMt5Account(
        String(snapshot.account.login),
        snapshot.account.server,
        snapshot.account.balance,
        snapshot.account.equity
      );
      setTailscaleMsg(`✓ MT5 Connected! Account #${snapshot.account.login} on ${snapshot.account.server}`);
    } catch (err) {
      setTailscaleMsg(`✗ Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setConnectingTailscale(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(Boolean(isStandaloneMode));

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
    }
  };

  if (!isOpen) return null;

  const termuxCommands = `pkg update -y && pkg install -y nodejs git
git clone https://github.com/nick12530/BLOCK1-SmC.git
cd BLOCK1-SmC
npm install
npm run mobile`;

  const termuxBackgroundCommands = `nohup npm run mobile > ~/mobile-server.log 2>&1 &
echo "Server running in background on port 3000"`;

  const iosIshCommands = `apk update && apk add nodejs npm git
git clone https://github.com/nick12530/BLOCK1-SmC.git
cd BLOCK1-SmC
npm install
npm run mobile`;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Mobile Web App &amp; Phone Server Hub
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isStandalone
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {isStandalone ? 'PWA Standalone Active' : 'Browser Web App'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Run independently on iOS &amp; Android · Start local server on your phone
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-3 sm:px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => setActiveTab('standalone_pwa')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'standalone_pwa'
                ? 'bg-sky-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>1. Install Mobile PWA</span>
          </button>

          <button
            onClick={() => setActiveTab('android_termux')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'android_termux'
                ? 'bg-sky-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>2. Android (Termux) Server</span>
          </button>

          <button
            onClick={() => setActiveTab('ios_ish')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ios_ish'
                ? 'bg-sky-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>3. iOS (iSH) Server</span>
          </button>

          <button
            onClick={() => setActiveTab('wifi_lan')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'wifi_lan'
                ? 'bg-sky-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>4. Tailscale &amp; LAN Sync</span>
          </button>

          <button
            onClick={() => setActiveTab('features')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'features'
                ? 'bg-sky-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>5. Standalone Features</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* TAB 1: STANDALONE MOBILE PWA */}
          {activeTab === 'standalone_pwa' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-sky-400">
                  <Zap className="w-4 h-4" />
                  <span>100% Independent Mobile Web App (Zero Setup Needed)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  The entire algorithmic trading terminal compiles into a standalone Progressive Web App (PWA). It runs directly in your phone’s browser engine with full touch support, local caching, and offline capability.
                </p>
              </div>

              {deferredPrompt && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-emerald-400 block">Direct Installation Available</span>
                    <span className="text-[11px] text-slate-300">Tap to add directly to your home screen right now.</span>
                  </div>
                  <button
                    onClick={handleInstallClick}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Install App</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* iOS Safari */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">iOS</span>
                      <span>iPhone &amp; iPad (Safari)</span>
                    </span>
                    <Share2 className="w-4 h-4 text-sky-400" />
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] font-sans leading-relaxed">
                    <li>Open this URL in <strong>Safari</strong> on your iPhone.</li>
                    <li>Tap the <strong>Share</strong> button at bottom toolbar (square with arrow up).</li>
                    <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.</li>
                    <li>Tap <strong>&quot;Add&quot;</strong> in top-right.</li>
                    <li>Launch the app from your home screen for fullscreen standalone mode!</li>
                  </ol>
                </div>

                {/* Android Chrome */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">Android</span>
                      <span>Google Chrome &amp; Brave</span>
                    </span>
                    <Download className="w-4 h-4 text-emerald-400" />
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] font-sans leading-relaxed">
                    <li>Open this URL in <strong>Chrome</strong> on your Android phone.</li>
                    <li>Tap the <strong>3 vertical dots menu (&vellip;)</strong> top-right.</li>
                    <li>Select <strong>&quot;Install App&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</li>
                    <li>Confirm installation prompt.</li>
                    <li>Launch with native APK-like standalone status bar and icon!</li>
                  </ol>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2 text-[11px] text-slate-300 font-sans">
                <span className="font-bold font-mono text-white block">Why Run Standalone?</span>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li><strong>Zero Address Bar:</strong> True edge-to-edge mobile viewing on OLED screens.</li>
                  <li><strong>Full Engine Autonomy:</strong> Calculates SMC Order Blocks, FVGs, and ATR volatility live on the phone.</li>
                  <li><strong>Offline Persistence:</strong> Positions, journal entries, and account balance persist in IndexedDB.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: ANDROID TERMUX */}
          {activeTab === 'android_termux' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <Terminal className="w-4 h-4" />
                  <span>Run the Node.js Server Directly on Android Phone via Termux</span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  You can start the development or production server natively on your Android phone without any computer using Termux (Linux terminal emulator).
                </p>
              </div>

              {/* Step 1: Install Termux */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <span className="font-bold text-white block">Step 1: Install Termux</span>
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                  Download Termux from <strong>F-Droid</strong> or <strong>GitHub Releases</strong> (avoid the obsolete Play Store version).
                </p>
              </div>

              {/* Step 2: One-Click Terminal Commands */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Step 2: Copy &amp; Run Terminal Setup</span>
                  <button
                    onClick={() => copyToClipboard(termuxCommands, 'termux_setup')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 transition-colors cursor-pointer text-[11px]"
                  >
                    {copiedKey === 'termux_setup' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'termux_setup' ? 'Copied!' : 'Copy Commands'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-black/80 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800">
                  {termuxCommands}
                </pre>
              </div>

              {/* Step 3: Run in Background */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Step 3 (Optional): Keep Server Running in Background</span>
                  <button
                    onClick={() => copyToClipboard(termuxBackgroundCommands, 'termux_bg')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 transition-colors cursor-pointer text-[11px]"
                  >
                    {copiedKey === 'termux_bg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'termux_bg' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-black/80 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800">
                  {termuxBackgroundCommands}
                </pre>
              </div>

              {/* Step 4: Open on Phone */}
              <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between">
                <div>
                  <span className="font-bold text-sky-300 block">Step 4: Open in Chrome</span>
                  <span className="text-[11px] text-slate-300">Open http://localhost:3000 in your phone’s browser!</span>
                </div>
                <a
                  href="http://localhost:3000"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition-colors flex items-center gap-1 text-[11px]"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: IOS ISH SERVER */}
          {activeTab === 'ios_ish' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-purple-400">
                  <Cpu className="w-4 h-4" />
                  <span>Run Node.js Server on iPhone / iPad via iSH or a-Shell</span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  iSH is an Alpine Linux shell emulator available directly from the Apple App Store on iOS.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <span className="font-bold text-white block">Step 1: Install iSH Shell</span>
                <p className="text-[11px] text-slate-400 font-sans">
                  Search <strong>&quot;iSH Shell&quot;</strong> in the App Store and install it.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Step 2: Copy &amp; Paste in iSH</span>
                  <button
                    onClick={() => copyToClipboard(iosIshCommands, 'ios_commands')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-400 transition-colors cursor-pointer text-[11px]"
                  >
                    {copiedKey === 'ios_commands' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'ios_commands' ? 'Copied!' : 'Copy Commands'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-black/80 text-purple-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                  {iosIshCommands}
                </pre>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1 text-slate-400 font-sans">
                <span className="font-bold text-white font-mono block">Step 3: Open in Safari</span>
                <p className="text-[11px]">
                  Once the server shows &quot;ready on port 3000&quot;, open <strong>http://localhost:3000</strong> in Safari!
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: TAILSCALE & WI-FI LOCAL NETWORK */}
          {activeTab === 'wifi_lan' && (
            <div className="space-y-4">
              {/* Tailscale Section */}
              <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sky-400">
                    <Wifi className="w-4 h-4" />
                    <span>Tailscale Private Mesh · Remote Phone Synchronization</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono font-bold">
                    Zero Ports Exposed
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  Tailscale creates a secure, encrypted WireGuard VPN mesh between your phone and your Windows MT5 PC. You can trade securely from anywhere in the world on mobile data or public Wi-Fi.
                </p>
              </div>

              {/* Tailscale Tester & Connect Card */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white block">Tailscale Bridge Address</span>
                  {bridgeStatus.connected && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-bold border border-emerald-500/30">
                      ✓ MT5 Connected ({bridgeStatus.latencyMs ? `${bridgeStatus.latencyMs}ms` : 'Active'})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tailscaleAddress}
                    onChange={(e) => setTailscaleAddress(e.target.value)}
                    className="flex-1 min-h-10 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs outline-none focus:border-sky-500"
                    placeholder="http://100.85.120.45:8000"
                  />
                  <button
                    onClick={handleTestTailscale}
                    disabled={tailscalePing?.testing}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold transition-colors cursor-pointer text-xs flex items-center gap-1.5 shrink-0"
                  >
                    {tailscalePing?.testing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Activity className="w-3.5 h-3.5" />
                    )}
                    <span>{tailscalePing?.testing ? 'Testing…' : 'Ping Link'}</span>
                  </button>
                  <button
                    onClick={handleConnectTailscale}
                    disabled={connectingTailscale}
                    className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition-colors cursor-pointer text-xs flex items-center gap-1.5 shrink-0"
                  >
                    {connectingTailscale ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>{connectingTailscale ? 'Connecting…' : 'Connect MT5'}</span>
                  </button>
                </div>

                {tailscalePing && !tailscalePing.testing && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-mono flex items-center justify-between border ${
                      tailscalePing.ok
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    <span>
                      {tailscalePing.ok
                        ? `✓ Tailscale Bridge reachable! Latency: ${tailscalePing.latencyMs}ms`
                        : `✗ Reachability test failed: ${tailscalePing.error}`}
                    </span>
                    {tailscalePing.ok && (
                      <span className="text-[10px] font-bold uppercase">
                        {tailscalePing.latencyMs! < 60 ? 'Direct P2P' : 'DERP Relay'}
                      </span>
                    )}
                  </div>
                )}

                {tailscaleMsg && (
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200">
                    {tailscaleMsg}
                  </div>
                )}

                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 font-sans space-y-1">
                  <span className="font-bold text-slate-300 font-mono block">3-Step Setup for Phone:</span>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Install <strong>Tailscale</strong> from App Store (iOS) or Play Store (Android).</li>
                    <li>Sign into the same Tailscale account on your PC and phone.</li>
                    <li>Copy your PC’s 100.x.y.z IP into the box above and tap <strong>Connect MT5</strong>!</li>
                  </ol>
                </div>
              </div>

              {/* Local Wi-Fi Section */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <span className="font-bold text-white block">Alternative: Local Wi-Fi Access (Same Router)</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400">Computer Local IP:</span>
                  <input
                    type="text"
                    value={customIp}
                    onChange={(e) => setCustomIp(e.target.value)}
                    className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs w-44"
                    placeholder="e.g. 192.168.1.12"
                  />
                </div>

                <div className="p-3 rounded-lg bg-black/80 border border-slate-800 flex items-center justify-between">
                  <span className="text-sky-400 font-bold font-mono">http://{customIp}:3000</span>
                  <button
                    onClick={() => copyToClipboard(`http://${customIp}:3000`, 'lan_url')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 transition-colors cursor-pointer text-[11px]"
                  >
                    {copiedKey === 'lan_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'lan_url' ? 'Copied' : 'Copy URL'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: STANDALONE ENGINE CAPABILITIES */}
          {activeTab === 'features' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <span className="font-bold text-white block">Independent Engine Architecture</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                    <strong className="text-emerald-400 block">✓ In-Browser SMC Engine</strong>
                    <span className="text-slate-400 font-sans">Detects Order Blocks, Fair Value Gaps, BOS, and 50% Equilibrium live in JavaScript/TypeScript.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                    <strong className="text-emerald-400 block">✓ Real-Time Multi-Timeframe Sync</strong>
                    <span className="text-slate-400 font-sans">Synchronizes M1, M5, M15, H1, and H4 candles and indicators in lockstep with the chart.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                    <strong className="text-emerald-400 block">✓ Standalone Paper Execution</strong>
                    <span className="text-slate-400 font-sans">Executes market orders, calculates dynamic stop loss, manages take profit, and updates equity without requiring MT5 bridge.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                    <strong className="text-emerald-400 block">✓ Remote MT5 Linking</strong>
                    <span className="text-slate-400 font-sans">When connected to your desktop MT5 bridge over WebSocket or LAN, orders seamlessly route to live broker.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-sans">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Standalone PWA Engine Ready</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-950 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Close &amp; Return to Terminal
          </button>
        </div>
      </div>
    </div>
  );
};

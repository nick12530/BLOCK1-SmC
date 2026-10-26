import { Candle, ClosedTrade, EconomicEvent, InstrumentType, TradeDirection } from '../types/smc';
import type { SymbolRiskSpec } from './riskConfig';

export interface BridgeAccountSnapshot {
  account: {
    login: number;
    server: string;
    balance: number;
    equity: number;
    margin_free: number;
    leverage?: number;
  };
  positions: Array<{
    ticket: number;
    symbol?: string;
    type: TradeDirection;
    volume: number;
    price_open: number;
    sl: number;
    tp: number;
    profit: number;
    magic: number;
    comment: string;
    time: string;
  }>;
  symbol: string;
  instrumentType: InstrumentType;
  accountMode: 'demo' | 'live' | 'contest' | 'unknown';
  tradingHalted: boolean;
  autoTrade: boolean;
  symbolSpec: SymbolRiskSpec;
  bid: number;
  ask: number;
  spread: number;
  candlesM1: Candle[];
  candlesM5: Candle[];
  candlesM15: Candle[];
  candlesH1: Candle[];
}

export interface BridgeStatus {
  connected: boolean;
  serverUrl: string;
  lastPing: number | null;
  lastError: string | null;
  mode: 'standalone' | 'demo' | 'live' | 'contest' | 'unknown';
  latencyMs?: number | null;
  isReconnecting?: boolean;
}

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8000';
export const getDefaultServerUrl = () =>
  typeof window === 'undefined' ? DEFAULT_SERVER_URL : `${window.location.origin}/mt5-bridge`;

export function normalizeLocalBridgeUrl(input: string): string {
  try {
    const parsed = new URL(input.trim());
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
      throw new Error('The MT5 bridge is PC-local; remote bridge URLs are not supported.');
    }
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${path}`;
  } catch (error) {
    if (error instanceof Error && error.message.includes('PC-local')) throw error;
    throw new Error('Enter a valid local MT5 bridge URL, such as http://127.0.0.1:8000.');
  }
}

function isDashboardBridgeProxy(url: string): boolean {
  return new URL(url).pathname.replace(/\/+$/, '').endsWith('/mt5-bridge');
}

export class MT5BridgeConnector {
  private serverUrl = getDefaultServerUrl();
  private symbol = 'XAUUSD';
  private instrumentType: InstrumentType = 'standard';
  private isConnected = false;
  private isReconnecting = false;
  private lastLatencyMs: number | null = null;
  private accountMode: BridgeStatus['mode'] = 'standalone';
  private expectedAccount: { login: number; server: string } | null = null;
  private historyPollInterval: ReturnType<typeof setInterval> | null = null;
  private calendarPollInterval: ReturnType<typeof setInterval> | null = null;
  private accountPollTimeout: ReturnType<typeof setTimeout> | null = null;
  private autoReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollingEnabled = false;
  private accountPollInFlight = false;
  private closedTradesInFlight = false;
  private calendarInFlight = false;
  private onDataCallback: ((data: BridgeAccountSnapshot) => void) | null = null;
  private onClosedTradesCallback: ((trades: ClosedTrade[]) => void) | null = null;
  private onEconomicCalendarCallback: ((events: EconomicEvent[] | null) => void) | null = null;
  private onConnectionChangeCallback: ((connected: boolean, error?: string) => void) | null = null;
  private lastPing: number | null = null;
  private lastError: string | null = null;
  private consecutiveErrors = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      // Rehydrate persistent connection state on terminal refresh so it does not disconnect
      const auto = localStorage.getItem('smc_mt5_auto_connect');
      if (auto === 'true') {
        const savedSymbol = localStorage.getItem('smc_mt5_symbol');
        if (savedSymbol) this.symbol = savedSymbol.trim();
        const savedType = localStorage.getItem('smc_mt5_instrument_type') as InstrumentType;
        if (savedType) this.instrumentType = savedType;
        const savedLogin = localStorage.getItem('smc_mt5_login');
        const savedServer = localStorage.getItem('smc_mt5_server');
        if (savedLogin && savedServer) {
          this.expectedAccount = { login: Number(savedLogin), server: savedServer };
          this.isConnected = true;
          this.isReconnecting = true;
        }
      }

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isConnected) {
          this.consecutiveErrors = 0;
          this.isReconnecting = false;
          void this.refreshAccount();
          void this.refreshClosedTrades();
        }
      });

      window.addEventListener('online', () => {
        if (this.isConnected) {
          this.consecutiveErrors = 0;
          this.isReconnecting = false;
          void this.refreshAccount();
        }
      });
    }
  }

  setCallback(callback: (data: BridgeAccountSnapshot) => void) {
    this.onDataCallback = callback;
  }

  setClosedTradesCallback(callback: (trades: ClosedTrade[]) => void) {
    this.onClosedTradesCallback = callback;
  }

  setEconomicCalendarCallback(callback: (events: EconomicEvent[] | null) => void) {
    this.onEconomicCalendarCallback = callback;
  }

  setConnectionChangeCallback(callback: (connected: boolean, error?: string) => void) {
    this.onConnectionChangeCallback = callback;
  }

  getStatus(): BridgeStatus {
    return {
      connected: this.isConnected,
      serverUrl: this.serverUrl,
      lastPing: this.lastPing,
      lastError: this.lastError,
      mode: this.isConnected ? this.accountMode : 'standalone',
      latencyMs: this.lastLatencyMs,
      isReconnecting: this.isReconnecting,
    };
  }

  /**
   * Performs an instant ping test to check the local PC bridge and its latency.
   */
  async ping(targetUrl?: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const rawUrl = targetUrl || this.serverUrl;
    let url: string;
    try {
      url = normalizeLocalBridgeUrl(rawUrl);
    } catch (error) {
      return {
        ok: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : 'Invalid local bridge URL.',
      };
    }
    url = url.replace(/\/+$/, '');
    const start = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    try {
      // First attempt /ping, fallback to /api/health
      let res: Response;
      try {
        res = await fetch(`${url}/ping`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
      } catch {
        res = await fetch(`${url}/api/health`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
      }
      const latencyMs = Math.round(performance.now() - start);
      // HTTP 200, 401 (token required), or 503 (MT5 desktop waiting) means bridge is online & reached
      if (res.ok || res.status === 401 || res.status === 503) {
        this.lastLatencyMs = latencyMs;
        this.lastPing = Date.now();
        return { ok: true, latencyMs };
      }
      return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        ok: false,
        latencyMs,
        error: err instanceof Error ? err.message : 'Timed out. Verify the local bridge is running.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  getSymbol(): string {
    return this.symbol;
  }

  async fetchSymbolSnapshot(symbol: string): Promise<BridgeAccountSnapshot> {
    if (!this.expectedAccount || !this.isConnected) {
      throw new Error('MT5 account identity is not verified.');
    }
    const snapshot = await this.request<BridgeAccountSnapshot>(
      `/api/account?symbol=${encodeURIComponent(symbol)}`,
      {}
    );
    if (
      Number(snapshot.account.login) !== Number(this.expectedAccount.login) ||
      snapshot.account.server !== this.expectedAccount.server
    ) {
      throw new Error('MT5 terminal account changed. Reconnect before reading market data.');
    }
    return { ...snapshot, instrumentType: this.instrumentType };
  }

  setSymbol(newSymbol: string) {
    if (!newSymbol) return;
    const clean = newSymbol.trim();
    const saved = typeof window !== 'undefined' ? localStorage.getItem('smc_mt5_symbol') : null;
    if (saved && saved.toUpperCase().startsWith(clean.toUpperCase())) {
      this.symbol = saved;
    } else {
      this.symbol = clean;
    }
    if (this.isConnected) {
      void this.refreshAccount();
      void this.refreshClosedTrades();
    }
  }

  async connectAccount(
    credentials: {
      baseUrl: string;
      symbol: string;
      instrumentType: InstrumentType;
    },
    isAutoReconnect = false
  ): Promise<BridgeAccountSnapshot> {
    this.serverUrl = normalizeLocalBridgeUrl(credentials.baseUrl);
    this.symbol = credentials.symbol.trim();
    this.instrumentType = credentials.instrumentType;
    this.stopPolling();
    if (!isAutoReconnect && !this.isConnected) {
      this.isConnected = false;
      this.isReconnecting = false;
      this.expectedAccount = null;
      this.lastPing = null;
      this.lastError = null;
      this.consecutiveErrors = 0;
      this.onConnectionChangeCallback?.(false);
      this.onEconomicCalendarCallback?.(null);
    } else {
      this.isReconnecting = true;
    }
    let snapshot: BridgeAccountSnapshot;
    const startPing = performance.now();
    try {
      snapshot = await this.request<BridgeAccountSnapshot>('/api/connect', {
        method: 'POST',
        body: JSON.stringify({ symbol: this.symbol }),
      });
      this.lastLatencyMs = Math.round(performance.now() - startPing);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown connection error.';
      this.lastError = isDashboardBridgeProxy(this.serverUrl)
        ? `Could not reach the MT5 bridge through the dashboard proxy at ${this.serverUrl}: ${detail} Start or restart the PC bridge launcher, keep both PowerShell windows open, and inspect the bridge window for startup errors.`
        : `Could not reach the local MT5 bridge at ${this.serverUrl}: ${detail} Start the bridge server and confirm MT5 Desktop is open and signed in.`;
      if (!isAutoReconnect) {
        this.onConnectionChangeCallback?.(false, this.lastError);
        throw new Error(this.lastError);
      } else {
        this.scheduleAutoReconnect();
        throw new Error(this.lastError);
      }
    }
    this.isConnected = true;
    this.isReconnecting = false;
    this.consecutiveErrors = 0;
    this.lastError = null;
    this.accountMode = snapshot.accountMode;
    this.expectedAccount = { login: Number(snapshot.account.login), server: snapshot.account.server };
    this.lastPing = Date.now();
    if (this.autoReconnectTimer) {
      clearTimeout(this.autoReconnectTimer);
      this.autoReconnectTimer = null;
    }
    this.onConnectionChangeCallback?.(true);
    void this.refreshEconomicCalendar();
    const instrumentSnapshot = { ...snapshot, instrumentType: this.instrumentType };
    this.onDataCallback?.(instrumentSnapshot);
    this.startPolling();
    void this.refreshClosedTrades();

    if (typeof window !== 'undefined') {
      localStorage.setItem('smc_mt5_auto_connect', 'true');
      localStorage.setItem('smc_mt5_symbol', this.symbol);
      localStorage.setItem('smc_mt5_base_url', this.serverUrl);
      localStorage.setItem('smc_mt5_instrument_type', this.instrumentType);
      localStorage.setItem('smc_mt5_login', String(snapshot.account.login));
      localStorage.setItem('smc_mt5_server', snapshot.account.server);
      localStorage.setItem('smc_mt5_broker', snapshot.account.server.split(/[-_]/)[0] || 'MT5 Broker');
    }

    return instrumentSnapshot;
  }

  async disconnectAccount(): Promise<void> {
    this.stopPolling();
    if (this.autoReconnectTimer) {
      clearTimeout(this.autoReconnectTimer);
      this.autoReconnectTimer = null;
    }
    this.isConnected = false;
    this.isReconnecting = false;
    this.accountMode = 'standalone';
    this.expectedAccount = null;
    this.lastPing = null;
    this.consecutiveErrors = 0;
    this.lastError = null;
    this.onConnectionChangeCallback?.(false);
    this.onEconomicCalendarCallback?.(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smc_mt5_auto_connect');
      localStorage.removeItem('smc_mt5_login');
      localStorage.removeItem('smc_mt5_server');
      localStorage.removeItem('smc_mt5_broker');
      localStorage.removeItem('smc_mt5_balance');
      localStorage.removeItem('smc_mt5_equity');
    }
  }

  private scheduleAutoReconnect(delayMs: number = 3000) {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('smc_mt5_auto_connect') !== 'true') return;
    if (this.autoReconnectTimer) clearTimeout(this.autoReconnectTimer);
    this.isReconnecting = true;
    this.autoReconnectTimer = setTimeout(() => {
      this.autoReconnectTimer = null;
      void this.autoConnectIfSaved().catch(() => {});
    }, delayMs);
  }

  async autoConnectIfSaved(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const auto = localStorage.getItem('smc_mt5_auto_connect');
    if (auto !== 'true') return false;
    const baseUrl = localStorage.getItem('smc_mt5_base_url') || getDefaultServerUrl();
    const symbol = localStorage.getItem('smc_mt5_symbol') || 'XAUUSD';
    const instrumentType = (localStorage.getItem('smc_mt5_instrument_type') as InstrumentType) || 'standard';
    try {
      await this.connectAccount({ baseUrl, symbol, instrumentType }, true);
      return true;
    } catch (err) {
      console.warn('[MT5 Bridge] Auto-connect attempt encountered bridge offline/connecting state; continuous daemon retrying...', err);
      this.scheduleAutoReconnect(3500);
      return false;
    }
  }

   async setTradingHalted(tradingHalted: boolean): Promise<void> {
     await this.request<{ tradingHalted: boolean }>('/api/trading-control', {
       method: 'POST',
       body: JSON.stringify({ tradingHalted }),
     });
   }

   async resetCircuitBreakers(): Promise<void> {
     await this.request<{ status: string }>('/api/reset-circuit-breakers', {
       method: 'POST',
     });
   }
   async setAutoTrade(autoTrade: boolean): Promise<void> {
     await this.request<{ autoTrade: boolean }>('/api/auto-trade-control', {
       method: 'POST',
       body: JSON.stringify({ autoTrade }),
     });
   }

   async sendTrade(trade: {
    direction: TradeDirection;
    volume: number;
    symbol: string;
    sl: number;
    tp: number;
    rationale: string;
    clientOrderId: string;
    poiKey: string;
    instrumentType: InstrumentType;
    signalTimeframe: 'M1' | 'M5' | 'M15';
    signalTimestamp: string;
    magic?: number;
    forceExecute?: boolean;
    bypassCooldown?: boolean;
  }): Promise<{
    ok: true;
    ticket: number;
    positionTicket?: number;
    price: number;
    filledVolume: number;
    partial: boolean;
    pending: boolean;
  }> {
    if (!this.expectedAccount || !this.isConnected) {
      throw new Error('MT5 account identity is not verified. Reconnect to the currently logged-in terminal account.');
    }
    const brokerSymbol =
      this.symbol && this.symbol.toUpperCase().startsWith(trade.symbol.toUpperCase())
        ? this.symbol
        : trade.symbol;

    const response = await this.request<{
      ok: true;
      ticket: number;
      positionTicket?: number;
      price: number;
      filledVolume: number;
      partial: boolean;
      pending: boolean;
      account: BridgeAccountSnapshot['account'];
      positions: BridgeAccountSnapshot['positions'];
      symbol: BridgeAccountSnapshot['symbol'];
      accountMode: BridgeAccountSnapshot['accountMode'];
      tradingHalted: boolean;
      autoTrade: boolean;
      symbolSpec: BridgeAccountSnapshot['symbolSpec'];
      bid: number;
      ask: number;
      spread: number;
      candlesM1: Candle[];
      candlesM5: Candle[];
      candlesM15: Candle[];
      candlesH1: Candle[];
    }>('/api/trade', {
      method: 'POST',
      body: JSON.stringify({
        ...trade,
        signalTimestamp: (() => {
          if (!trade.signalTimestamp) return new Date().toISOString();
          const parsed = new Date(trade.signalTimestamp).getTime();
          if (Number.isNaN(parsed) || parsed > Date.now()) {
            return new Date().toISOString();
          }
          return new Date(parsed).toISOString();
        })(),
        symbol: brokerSymbol,
        clientOrderId: trade.clientOrderId,
        poiKey: trade.poiKey,
        expectedLogin: this.expectedAccount.login,
        expectedServer: this.expectedAccount.server,
        // SAFETY-FIX: Pass through caller's actual flags instead of hardcoded true bypasses
        bypassCooldown: trade.bypassCooldown ?? false,
        forceExecute: trade.forceExecute ?? false,
      }),
    });
    this.lastPing = Date.now();
    this.onDataCallback?.({
      account: response.account,
      positions: response.positions,
      symbol: response.symbol,
      accountMode: response.accountMode,
      tradingHalted: response.tradingHalted,
      autoTrade: response.autoTrade,
      instrumentType: trade.instrumentType,
      symbolSpec: response.symbolSpec,
      bid: response.bid,
      ask: response.ask,
      spread: response.spread,
      candlesM1: response.candlesM1,
      candlesM5: response.candlesM5,
      candlesM15: response.candlesM15,
      candlesH1: response.candlesH1,
    });
    return {
      ok: response.ok,
      ticket: response.ticket,
      positionTicket: response.positionTicket,
      price: response.price,
      filledVolume: response.filledVolume,
      partial: response.partial,
      pending: response.pending,
    };
  }

  async closePosition(ticket: number, volume?: number): Promise<void> {
    if (!this.expectedAccount || !this.isConnected) throw new Error('MT5 account identity is not verified.');
    const snapshot = await this.request<BridgeAccountSnapshot>('/api/close', {
      method: 'POST',
      body: JSON.stringify({
        ticket,
        ...(volume === undefined ? {} : { volume }),
        expectedLogin: this.expectedAccount.login,
        expectedServer: this.expectedAccount.server,
      }),
    });
    this.lastPing = Date.now();
    this.accountMode = snapshot.accountMode;
    this.onDataCallback?.({ ...snapshot, instrumentType: this.instrumentType });
    void this.refreshClosedTrades();
  }

  async modifyPositionStops(ticket: number, sl: number, tp: number): Promise<void> {
    if (!this.expectedAccount || !this.isConnected) throw new Error('MT5 account identity is not verified.');
    const snapshot = await this.request<BridgeAccountSnapshot>('/api/modify', {
      method: 'POST',
      body: JSON.stringify({ ticket, sl, tp, expectedLogin: this.expectedAccount.login, expectedServer: this.expectedAccount.server }),
    });
    this.lastPing = Date.now();
    this.onDataCallback?.({ ...snapshot, instrumentType: this.instrumentType });
  }

  private startPolling() {
    this.stopPolling();
    this.pollingEnabled = true;
    this.scheduleAccountPoll(0);
    this.historyPollInterval = setInterval(() => {
      void this.refreshClosedTrades();
    }, 30_000);
    this.calendarPollInterval = setInterval(() => {
      void this.refreshEconomicCalendar();
    }, 15 * 60_000);
    void this.refreshEconomicCalendar();
  }

  private stopPolling() {
    this.pollingEnabled = false;
    if (this.accountPollTimeout) clearTimeout(this.accountPollTimeout);
    this.accountPollTimeout = null;
    if (this.historyPollInterval) clearInterval(this.historyPollInterval);
    this.historyPollInterval = null;
    if (this.calendarPollInterval) clearInterval(this.calendarPollInterval);
    this.calendarPollInterval = null;
  }

  private scheduleAccountPoll(delayMs: number) {
    if (!this.pollingEnabled || this.accountPollTimeout) return;
    this.accountPollTimeout = setTimeout(() => {
      this.accountPollTimeout = null;
      void this.refreshAccount();
    }, delayMs);
  }

  private async refreshAccount() {
    if (!this.pollingEnabled || this.accountPollInFlight) return;
    this.accountPollInFlight = true;
    let failed = false;
    try {
      const snapshot = await this.request<BridgeAccountSnapshot>(
        `/api/account?symbol=${encodeURIComponent(this.symbol)}`,
        {}
      );
      if (!this.pollingEnabled) return;
      if (
        this.expectedAccount &&
        Number(snapshot.account.login) !== Number(this.expectedAccount.login)
      ) {
        this.isConnected = false;
        this.accountMode = 'unknown';
        this.pollingEnabled = false;
        throw new Error('MT5 terminal account changed. Trading is paused; verify and reconnect to the intended account.');
      }
      if (!this.expectedAccount) {
        this.expectedAccount = { login: Number(snapshot.account.login), server: snapshot.account.server };
      }
      this.lastPing = Date.now();
      this.isConnected = true;
      this.isReconnecting = false;
      this.lastError = null;
      this.onConnectionChangeCallback?.(true);
      this.accountMode = snapshot.accountMode;
      this.consecutiveErrors = 0;
      this.onDataCallback?.({ ...snapshot, instrumentType: this.instrumentType });
    } catch (error) {
      failed = true;
      this.consecutiveErrors += 1;
      this.lastError = error instanceof Error ? error.message : 'Unknown MT5 bridge polling error.';

      // When bridge fails, mark disconnected so engine falls back cleanly to desk execution
      const auto = typeof window !== 'undefined' && localStorage.getItem('smc_mt5_auto_connect') === 'true';
      if (this.consecutiveErrors >= 2) {
        this.isConnected = false;
        this.onConnectionChangeCallback?.(false, this.lastError);
      }
      if (auto) {
        this.isReconnecting = true;
      } else if (this.consecutiveErrors >= 3) {
        this.isReconnecting = false;
      }
      console.warn(`[MT5 Bridge] Sync attempt (${this.consecutiveErrors}); offline/retry state:`, error);
    } finally {
      this.accountPollInFlight = false;
      if (this.pollingEnabled) {
        const retryDelay = Math.min(15_000, 1_500 * (2 ** Math.min(this.consecutiveErrors, 3)));
        this.scheduleAccountPoll(failed ? retryDelay : 2_000);
      }
    }
  }

  private async refreshClosedTrades() {
    if (!this.isConnected || this.closedTradesInFlight) return;
    this.closedTradesInFlight = true;
    try {
      const trades = await this.request<ClosedTrade[]>(
        `/api/history?days=180&symbol=${encodeURIComponent(this.symbol)}`,
        {}
      );
      this.onClosedTradesCallback?.(trades);
    } catch (error) {
      console.error('[MT5 Bridge] Closed-trade history refresh failed:', error);
    } finally {
      this.closedTradesInFlight = false;
    }
  }

  private async refreshEconomicCalendar() {
    if (!this.isConnected || this.calendarInFlight) return;
    this.calendarInFlight = true;
    try {
      const response = await this.request<{
        available: boolean;
        events: EconomicEvent[];
      }>('/api/economic-calendar', {});
      if (!response.available || !Array.isArray(response.events)) {
        throw new Error('The economic calendar returned an invalid response.');
      }
      this.onEconomicCalendarCallback?.(response.events);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown economic calendar error.';
      this.onEconomicCalendarCallback?.(null);
      console.warn(`[MT5 Bridge] Economic calendar unavailable; standard setups remain blocked: ${detail}`);
    } finally {
      this.calendarInFlight = false;
    }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    // Bound local bridge requests so a stopped process cannot stall the terminal.
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const start = performance.now();
    const baseUrl = this.serverUrl.replace(/\/+$/, '');
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
      this.lastLatencyMs = Math.round(performance.now() - start);

      const contentType = response.headers.get('content-type') || '';
      let data: any;
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = null;
        }
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text ? { detail: text.slice(0, 160) } : null;
        }
      }

      if (!response.ok) {
        const detail = (data as { detail?: string })?.detail;
        if (response.status === 502 && isDashboardBridgeProxy(baseUrl)) {
          throw new Error(
            `The dashboard proxy at ${baseUrl} cannot reach the Python MT5 bridge. Start or restart the PC bridge launcher, keep both PowerShell windows open, and inspect the bridge window for startup errors.`
          );
        }
        if (detail) {
          throw new Error(detail);
        }
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          throw new Error(`MT5 Bridge is currently standby (${response.status} Bad Gateway). Ensure your Python bridge server (uvicorn) is active at ${baseUrl}.`);
        }
        throw new Error(`MT5 bridge request failed (${response.status}).`);
      }
      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const mt5Bridge = new MT5BridgeConnector();

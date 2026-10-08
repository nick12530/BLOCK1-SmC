import { Candle, ClosedTrade, InstrumentType, TradeDirection } from '../types/smc';
import type { SymbolRiskSpec } from './riskConfig';

export interface BridgeAccountSnapshot {
  account: {
    login: number;
    server: string;
    balance: number;
    equity: number;
    margin_free: number;
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
}

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8000';
export const getDefaultServerUrl = () =>
  typeof window === 'undefined' ? DEFAULT_SERVER_URL : `${window.location.origin}/mt5-bridge`;

export class MT5BridgeConnector {
  private serverUrl = getDefaultServerUrl();
  private symbol = 'XAUUSD';
  private instrumentType: InstrumentType = 'standard';
  private isConnected = false;
  private accountMode: BridgeStatus['mode'] = 'standalone';
  private expectedAccount: { login: number; server: string } | null = null;
  private historyPollInterval: ReturnType<typeof setInterval> | null = null;
  private accountPollTimeout: ReturnType<typeof setTimeout> | null = null;
  private pollingEnabled = false;
  private accountPollInFlight = false;
  private onDataCallback: ((data: BridgeAccountSnapshot) => void) | null = null;
  private onClosedTradesCallback: ((trades: ClosedTrade[]) => void) | null = null;
  private onConnectionChangeCallback: ((connected: boolean, error?: string) => void) | null = null;
  private lastPing: number | null = null;
  private lastError: string | null = null;

  setCallback(callback: (data: BridgeAccountSnapshot) => void) {
    this.onDataCallback = callback;
  }

  setClosedTradesCallback(callback: (trades: ClosedTrade[]) => void) {
    this.onClosedTradesCallback = callback;
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
    };
  }

  getSymbol(): string {
    return this.symbol;
  }

  setSymbol(newSymbol: string) {
    if (!newSymbol) return;
    this.symbol = newSymbol.trim();
    if (this.isConnected) {
      void this.refreshAccount();
      void this.refreshClosedTrades();
    }
  }

  private consecutiveErrors = 0;

  async connectAccount(credentials: {
    baseUrl: string;
    symbol: string;
    instrumentType: InstrumentType;
  }): Promise<BridgeAccountSnapshot> {
    this.serverUrl = credentials.baseUrl.replace(/\/+$/, '');
    this.symbol = credentials.symbol.trim();
    this.instrumentType = credentials.instrumentType;
    this.stopPolling();
    this.isConnected = false;
    this.expectedAccount = null;
    this.lastPing = null;
    this.lastError = null;
    this.onConnectionChangeCallback?.(false);
    let snapshot: BridgeAccountSnapshot;
    try {
      snapshot = await this.request<BridgeAccountSnapshot>('/api/connect', {
        method: 'POST',
        body: JSON.stringify({ symbol: this.symbol }),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown connection error.';
      this.lastError = `Could not connect to the MT5 bridge at ${this.serverUrl}: ${detail} Start the private-link launcher on the MT5 PC and keep its windows open.`;
      this.onConnectionChangeCallback?.(false, this.lastError);
      throw new Error(this.lastError);
    }
    this.isConnected = true;
    this.consecutiveErrors = 0;
    this.lastError = null;
    this.accountMode = snapshot.accountMode;
    this.expectedAccount = { login: snapshot.account.login, server: snapshot.account.server };
    this.lastPing = Date.now();
    this.onConnectionChangeCallback?.(true);
    const instrumentSnapshot = { ...snapshot, instrumentType: this.instrumentType };
    this.onDataCallback?.(instrumentSnapshot);
    this.startPolling();
    void this.refreshClosedTrades();

    if (typeof window !== 'undefined') {
      localStorage.setItem('smc_mt5_auto_connect', 'true');
      localStorage.setItem('smc_mt5_symbol', this.symbol);
      localStorage.setItem('smc_mt5_base_url', this.serverUrl);
      localStorage.setItem('smc_mt5_instrument_type', this.instrumentType);
    }

    return instrumentSnapshot;
  }

  async disconnectAccount(): Promise<void> {
    this.stopPolling();
    this.isConnected = false;
    this.accountMode = 'standalone';
    this.expectedAccount = null;
    this.lastPing = null;
    this.consecutiveErrors = 0;
    this.lastError = null;
    this.onConnectionChangeCallback?.(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smc_mt5_auto_connect');
    }
  }

  async autoConnectIfSaved(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const auto = localStorage.getItem('smc_mt5_auto_connect');
    if (auto !== 'true') return false;
    const baseUrl = localStorage.getItem('smc_mt5_base_url') || getDefaultServerUrl();
    const symbol = localStorage.getItem('smc_mt5_symbol') || 'XAUUSD';
    const instrumentType = (localStorage.getItem('smc_mt5_instrument_type') as InstrumentType) || 'standard';
    try {
      await this.connectAccount({ baseUrl, symbol, instrumentType });
      return true;
    } catch {
      return false;
    }
  }

   async setTradingHalted(tradingHalted: boolean): Promise<void> {
     await this.request<{ tradingHalted: boolean }>('/api/trading-control', {
       method: 'POST',
       body: JSON.stringify({ tradingHalted }),
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
    signalTimeframe: 'M1' | 'M5';
    signalTimestamp: string;
    magic?: number;
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
        clientOrderId: trade.clientOrderId,
        poiKey: trade.poiKey,
        expectedLogin: this.expectedAccount.login,
        expectedServer: this.expectedAccount.server,
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

  async closePosition(ticket: number): Promise<void> {
    if (!this.expectedAccount || !this.isConnected) throw new Error('MT5 account identity is not verified.');
    const snapshot = await this.request<BridgeAccountSnapshot>('/api/close', {
      method: 'POST',
      body: JSON.stringify({ ticket, expectedLogin: this.expectedAccount.login, expectedServer: this.expectedAccount.server }),
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
  }

  private stopPolling() {
    this.pollingEnabled = false;
    if (this.accountPollTimeout) clearTimeout(this.accountPollTimeout);
    this.accountPollTimeout = null;
    if (this.historyPollInterval) clearInterval(this.historyPollInterval);
    this.historyPollInterval = null;
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
        !this.expectedAccount ||
        snapshot.account.login !== this.expectedAccount.login ||
        snapshot.account.server !== this.expectedAccount.server
      ) {
        this.isConnected = false;
        this.accountMode = 'unknown';
        this.pollingEnabled = false;
        throw new Error('MT5 terminal account changed. Trading is paused; verify and reconnect to the intended account.');
      }
      this.lastPing = Date.now();
      this.isConnected = true;
      this.lastError = null;
      this.onConnectionChangeCallback?.(true);
      this.accountMode = snapshot.accountMode;
      this.consecutiveErrors = 0;
      this.onDataCallback?.({ ...snapshot, instrumentType: this.instrumentType });
    } catch (error) {
      failed = true;
      this.isConnected = false;
      this.consecutiveErrors += 1;
      this.lastError = error instanceof Error ? error.message : 'Unknown MT5 bridge polling error.';
      this.onConnectionChangeCallback?.(false, this.lastError);
      console.error(`[MT5 Bridge] Account sync failed (attempt ${this.consecutiveErrors}); retrying:`, error);
    } finally {
      this.accountPollInFlight = false;
      if (this.pollingEnabled) {
        const retryDelay = Math.min(30_000, 2_000 * (2 ** Math.min(this.consecutiveErrors, 4)));
        this.scheduleAccountPoll(failed ? retryDelay : 2_000);
      }
    }
  }

  private async refreshClosedTrades() {
    if (!this.isConnected) return;
    try {
      const trades = await this.request<ClosedTrade[]>(
        `/api/history?days=180&symbol=${encodeURIComponent(this.symbol)}`,
        {}
      );
      this.onClosedTradesCallback?.(trades);
    } catch (error) {
      console.error('[MT5 Bridge] Closed-trade history refresh failed:', error);
    }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(`${this.serverUrl}${path}`, {
        ...init,
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
      const data = (await response.json()) as T | { detail?: string };
      if (!response.ok) {
        const detail = (data as { detail?: string }).detail;
        throw new Error(detail || `MT5 bridge request failed (${response.status}).`);
      }
      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const mt5Bridge = new MT5BridgeConnector();

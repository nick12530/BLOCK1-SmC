import { Candle, ClosedTrade, TradeDirection } from '../types/smc';

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
  bid: number;
  ask: number;
  spread: number;
  candlesM15: Candle[];
  candlesH1: Candle[];
}

export interface BridgeStatus {
  connected: boolean;
  serverUrl: string;
  lastPing: number | null;
  mode: 'standalone' | 'mt5_live';
}

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8000';
const getDefaultServerUrl = () =>
  typeof window === 'undefined' ? DEFAULT_SERVER_URL : `${window.location.origin}/mt5-bridge`;

export class MT5BridgeConnector {
  private serverUrl = getDefaultServerUrl();
  private symbol = 'XAUUSD';
  private isConnected = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private historyPollInterval: ReturnType<typeof setInterval> | null = null;
  private onDataCallback: ((data: BridgeAccountSnapshot) => void) | null = null;
  private onClosedTradesCallback: ((trades: ClosedTrade[]) => void) | null = null;
  private lastPing: number | null = null;

  setCallback(callback: (data: BridgeAccountSnapshot) => void) {
    this.onDataCallback = callback;
  }

  setClosedTradesCallback(callback: (trades: ClosedTrade[]) => void) {
    this.onClosedTradesCallback = callback;
  }

  getStatus(): BridgeStatus {
    return {
      connected: this.isConnected,
      serverUrl: this.serverUrl,
      lastPing: this.lastPing,
      mode: this.isConnected ? 'mt5_live' : 'standalone',
    };
  }

  getSymbol(): string {
    return this.symbol;
  }

  async connectAccount(credentials: {
    baseUrl: string;
    symbol: string;
  }): Promise<BridgeAccountSnapshot> {
    this.serverUrl = credentials.baseUrl.replace(/\/+$/, '');
    this.symbol = credentials.symbol.trim();
    const snapshot = await this.request<BridgeAccountSnapshot>('/api/connect', {
      method: 'POST',
      body: JSON.stringify({ symbol: this.symbol }),
    });
    this.isConnected = true;
    this.lastPing = Date.now();
    this.onDataCallback?.(snapshot);
    this.startPolling();
    void this.refreshClosedTrades();
    return snapshot;
  }

  async disconnectAccount(): Promise<void> {
    this.stopPolling();
    this.isConnected = false;
    this.lastPing = null;
  }

  async sendTrade(trade: {
    direction: TradeDirection;
    volume: number;
    symbol: string;
    sl: number;
    tp: number;
    rationale: string;
  }): Promise<{ ok: true; ticket: number; positionTicket?: number; price: number }> {
    const response = await this.request<{
      ok: true;
      ticket: number;
      positionTicket?: number;
      price: number;
      account: BridgeAccountSnapshot['account'];
      positions: BridgeAccountSnapshot['positions'];
      symbol: BridgeAccountSnapshot['symbol'];
      bid: number;
      ask: number;
      spread: number;
      candlesM15: Candle[];
      candlesH1: Candle[];
    }>('/api/trade', {
      method: 'POST',
      body: JSON.stringify(trade),
    });
    this.lastPing = Date.now();
    this.onDataCallback?.({
      account: response.account,
      positions: response.positions,
      symbol: response.symbol,
      bid: response.bid,
      ask: response.ask,
      spread: response.spread,
      candlesM15: response.candlesM15,
      candlesH1: response.candlesH1,
    });
    return {
      ok: response.ok,
      ticket: response.ticket,
      positionTicket: response.positionTicket,
      price: response.price,
    };
  }

  async closePosition(ticket: number): Promise<void> {
    const snapshot = await this.request<BridgeAccountSnapshot>('/api/close', {
      method: 'POST',
      body: JSON.stringify({ ticket }),
    });
    this.lastPing = Date.now();
    this.onDataCallback?.(snapshot);
    void this.refreshClosedTrades();
  }

  async modifyPositionStops(ticket: number, sl: number, tp: number): Promise<void> {
    const snapshot = await this.request<BridgeAccountSnapshot>('/api/modify', {
      method: 'POST',
      body: JSON.stringify({ ticket, sl, tp }),
    });
    this.lastPing = Date.now();
    this.onDataCallback?.(snapshot);
  }

  private startPolling() {
    this.stopPolling();
    this.pollInterval = setInterval(() => {
      void this.refreshAccount();
    }, 2000);
    this.historyPollInterval = setInterval(() => {
      void this.refreshClosedTrades();
    }, 30_000);
  }

  private stopPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = null;
    if (this.historyPollInterval) clearInterval(this.historyPollInterval);
    this.historyPollInterval = null;
  }

  private async refreshAccount() {
    try {
      const snapshot = await this.request<BridgeAccountSnapshot>(
        `/api/account?symbol=${encodeURIComponent(this.symbol)}`,
        {}
      );
      this.lastPing = Date.now();
      this.onDataCallback?.(snapshot);
    } catch (error) {
      this.isConnected = false;
      this.stopPolling();
      console.error('[MT5 Bridge] Account polling stopped:', error);
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
    const response = await fetch(`${this.serverUrl}${path}`, {
      ...init,
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
  }
}

export const mt5Bridge = new MT5BridgeConnector();

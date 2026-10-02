/**
 * mt5Bridge.ts - Production MetaTrader 5 & Python Server Bridge Connector
 * Connects to local or remote server.py bridge (ws://127.0.0.1:8000/ws)
 * Falls back to internal SMC execution engine if server is offline.
 */

export interface BridgeStatus {
  connected: boolean;
  serverUrl: string;
  lastPing: number | null;
  mode: 'standalone' | 'mt5_live';
}

export class MT5BridgeConnector {
  private ws: WebSocket | null = null;
  private serverUrl: string = 'ws://127.0.0.1:8000/ws';
  private restUrl: string = 'http://127.0.0.1:8000';
  private isConnected: boolean = false;
  private reconnectTimeout: any = null;
  private onDataCallback: ((data: any) => void) | null = null;
  private mode: 'standalone' | 'mt5_live' = 'standalone';

  constructor() {
    // Check if user specified a custom bridge in localStorage
    const savedUrl = localStorage.getItem('smc_mt5_bridge_url');
    if (savedUrl) {
      this.serverUrl = savedUrl;
    }
  }

  setCallback(cb: (data: any) => void) {
    this.onDataCallback = cb;
  }

  setMode(mode: 'standalone' | 'mt5_live') {
    this.mode = mode;
    if (mode === 'mt5_live') {
      this.connect();
    } else {
      this.disconnect();
    }
  }

  getMode() {
    return this.mode;
  }

  getStatus(): BridgeStatus {
    return {
      connected: this.isConnected,
      serverUrl: this.serverUrl,
      lastPing: this.isConnected ? Date.now() : null,
      mode: this.mode,
    };
  }

  connect(customUrl?: string) {
    if (customUrl) {
      this.serverUrl = customUrl;
      localStorage.setItem('smc_mt5_bridge_url', customUrl);
    }

    if (this.ws) {
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.mode = 'mt5_live';
        console.log(`[MT5 Bridge] Connected to Python server at ${this.serverUrl}`);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onDataCallback) {
            this.onDataCallback(data);
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        if (this.mode === 'mt5_live') {
          // Try reconnect in 5 seconds
          this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
        }
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch (err) {
      this.isConnected = false;
    }
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  async sendTrade(tradeData: { direction: 'BUY' | 'SELL'; lot: number; sl_pips: number; rr: number }) {
    if (this.isConnected && this.mode === 'mt5_live') {
      try {
        const res = await fetch(`${this.restUrl}/api/trade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tradeData),
        });
        return await res.json();
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    }
    return null;
  }
}

export const mt5Bridge = new MT5BridgeConnector();

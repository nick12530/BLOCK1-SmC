import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeTailscaleUrl, getDefaultServerUrl, mt5Bridge } from './mt5Bridge';

describe('MT5 Bridge Link & Normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('normalizeTailscaleUrl', () => {
    it('preserves web proxy /mt5-bridge paths without stripping pathname', () => {
      const url = normalizeTailscaleUrl('https://example.com/mt5-bridge');
      expect(url).toBe('https://example.com/mt5-bridge');
    });

    it('handles relative path /mt5-bridge', () => {
      const url = normalizeTailscaleUrl('/mt5-bridge');
      expect(url).toContain('/mt5-bridge');
    });

    it('formats pure Tailscale 100.x.y.z IP with default port 8000', () => {
      const url = normalizeTailscaleUrl('100.85.120.45');
      expect(url).toBe('http://100.85.120.45:8000');
    });

    it('formats Tailscale IP with explicit port', () => {
      const url = normalizeTailscaleUrl('100.85.120.45:8000');
      expect(url).toBe('http://100.85.120.45:8000');
    });

    it('formats MagicDNS .ts.net address with HTTPS', () => {
      const url = normalizeTailscaleUrl('my-desktop.tailnet.ts.net');
      expect(url).toBe('https://my-desktop.tailnet.ts.net');
    });

    it('trims trailing slashes', () => {
      const url = normalizeTailscaleUrl('http://127.0.0.1:8000///');
      expect(url).toBe('http://127.0.0.1:8000');
    });
  });

  describe('getDefaultServerUrl', () => {
    it('defaults to web proxy /mt5-bridge when no stored URL', () => {
      const defaultUrl = getDefaultServerUrl();
      expect(defaultUrl).toContain('/mt5-bridge');
    });

    it('uses stored Tailscale URL when available', () => {
      localStorage.setItem('smc_tailscale_url', '100.85.120.45');
      const defaultUrl = getDefaultServerUrl();
      expect(defaultUrl).toBe('http://100.85.120.45:8000');
    });
  });

  describe('ping reachability', () => {
    it('returns ok: true when bridge server responds with HTTP 200', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', connected: true }),
      } as any);

      const result = await mt5Bridge.ping('http://127.0.0.1:8000');
      expect(result.ok).toBe(true);
      expect(typeof result.latencyMs).toBe('number');
    });

    it('recognizes HTTP 401 (token required) as reached and responsive', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as any);

      const result = await mt5Bridge.ping('http://127.0.0.1:8000');
      expect(result.ok).toBe(true);
    });

    it('returns informative error when host is unreachable', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      const result = await mt5Bridge.ping('http://127.0.0.1:8000');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Failed to fetch');
    });
  });
});

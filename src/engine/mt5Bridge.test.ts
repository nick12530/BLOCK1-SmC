import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeLocalBridgeUrl, getDefaultServerUrl, MT5BridgeConnector, mt5Bridge } from './mt5Bridge';

describe('PC-local MT5 Bridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('normalizeLocalBridgeUrl', () => {
    it('accepts a local address and trims trailing slashes', () => {
      expect(normalizeLocalBridgeUrl('http://127.0.0.1:8000///')).toBe('http://127.0.0.1:8000');
      expect(normalizeLocalBridgeUrl('http://localhost:8000')).toBe('http://localhost:8000');
    });

    it('rejects remote bridge addresses', () => {
      expect(() => normalizeLocalBridgeUrl('https://example.com')).toThrow('PC-local');
      expect(() => normalizeLocalBridgeUrl('http://100.85.120.45:8000')).toThrow('PC-local');
    });

    it('rejects malformed addresses', () => {
      expect(() => normalizeLocalBridgeUrl('not a URL')).toThrow('valid local MT5 bridge URL');
    });
  });

  describe('getDefaultServerUrl', () => {
    it('always defaults to the local Windows bridge', () => {
      localStorage.setItem('smc_mt5_base_url', 'https://example.com');
      const defaultUrl = getDefaultServerUrl();
      expect(new URL(defaultUrl).hostname).toBe('localhost');
      expect(defaultUrl).toBe(`${window.location.origin}/mt5-bridge`);
    });
  });

  it('does not ping remote bridge URLs', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const result = await mt5Bridge.ping('https://example.com');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('PC-local');
    expect(fetchSpy).not.toHaveBeenCalled();
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

  it('explains that a dashboard-proxy 502 means its Python bridge upstream is unreachable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    } as any);
    const connector = new MT5BridgeConnector();

    await expect(connector.connectAccount({
      baseUrl: 'http://127.0.0.1:4173/mt5-bridge',
      symbol: 'EURUSD',
      instrumentType: 'standard',
    })).rejects.toThrow(
      'dashboard proxy at http://127.0.0.1:4173/mt5-bridge cannot reach the Python MT5 bridge'
    );
  });
});

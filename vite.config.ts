import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

import fs from 'fs';
import os from 'os';

function resolveBridgeToken(): string {
  const envToken = process.env.SMC_BRIDGE_TOKEN?.trim();
  if (envToken) return envToken;

  try {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const tokenFile = path.join(localAppData, 'SMCBridge', 'bridge_token.txt');
    if (fs.existsSync(tokenFile)) {
      const stored = fs.readFileSync(tokenFile, 'utf-8').trim();
      if (stored) return stored;
    }
  } catch {
    // Ignore errors reading local file
  }

  try {
    const homeTokenFile = path.join(os.homedir(), '.smcbridge', 'bridge_token.txt');
    if (fs.existsSync(homeTokenFile)) {
      const stored = fs.readFileSync(homeTokenFile, 'utf-8').trim();
      if (stored) return stored;
    }
  } catch {}

  return '';
}

const bridgePort = process.env.SMC_BRIDGE_PORT || '8000';
const mt5Proxy = {
  '/mt5-bridge': {
    target: `http://127.0.0.1:${bridgePort}`,
    changeOrigin: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/mt5-bridge/, ''),
    configure: (proxy: any) => {
      proxy.on('proxyReq', (proxyReq: any) => {
        const token = resolveBridgeToken();
        if (token && !proxyReq.getHeader('authorization')) {
          proxyReq.setHeader('authorization', `Bearer ${token}`);
        }
      });
    },
  },
};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as true,
      proxy: mt5Proxy,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as true,
      proxy: mt5Proxy,
    },
  };
});


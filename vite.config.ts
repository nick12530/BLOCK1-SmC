import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bridgeToken = process.env.SMC_BRIDGE_TOKEN;
const bridgePort = Number(process.env.SMC_BRIDGE_PORT || 8000);
const previewPort = Number(process.env.SMC_DASHBOARD_PORT || 4173);
const mt5Proxy = {
  '/mt5-bridge': {
    target: `http://127.0.0.1:${bridgePort}`,
    changeOrigin: true,
    headers: bridgeToken ? { Authorization: `Bearer ${bridgeToken}` } : {},
    rewrite: (requestPath: string) => requestPath.replace(/^\/mt5-bridge/, ''),
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
      host: '127.0.0.1',
      proxy: mt5Proxy,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: '127.0.0.1',
      port: previewPort,
      strictPort: true,
      proxy: mt5Proxy,
    },
  };
});

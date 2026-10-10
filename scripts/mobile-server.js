#!/usr/bin/env node
/**
 * mobile-server.js
 * Lightweight, zero-dependency Node.js HTTP server optimized for mobile devices:
 * - Android (Termux)
 * - iOS (iSH Shell, a-Shell)
 * - Local Wi-Fi network distribution
 *
 * Runs standalone without requiring large build dependencies.
 * Automatically binds to 0.0.0.0 and prints local & LAN IP access links.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function getNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const server = http.createServer((req, res) => {
  // CORS & Security headers for mobile PWA
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Check health check
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', mobileServer: true, time: new Date().toISOString() }));
    return;
  }

  // Parse path
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(DIST_DIR, reqPath);

  // If dist doesn't exist, check if public folder has it (e.g. dev mode fallback)
  if (!fs.existsSync(filePath)) {
    const publicPath = path.join(ROOT_DIR, 'public', reqPath);
    if (fs.existsSync(publicPath)) {
      filePath = publicPath;
    }
  }

  // Check if file exists, else fallback to index.html (SPA client routing)
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(DIST_DIR, 'index.html');
      if (!fs.existsSync(filePath)) {
        filePath = path.join(ROOT_DIR, 'index.html');
      }
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('SMC Terminal Mobile Server: File not found. Run npm run build first for full dist.');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      res.end(content);
    });
  });
});

server.listen(PORT, HOST, () => {
  const netAddrs = getNetworkAddresses();
  console.log('\n======================================================');
  console.log('📱 SMC GOLD BOT — STANDALONE MOBILE WEB APP SERVER');
  console.log('======================================================');
  console.log(`✓ Server running directly on your device on port ${PORT}`);
  console.log(`\n• Local (on this phone):   http://localhost:${PORT}`);
  if (netAddrs.length > 0) {
    netAddrs.forEach((ip) => {
      console.log(`• Network (Wi-Fi / LAN):   http://${ip}:${PORT}`);
    });
  } else {
    console.log(`• Network:                 http://0.0.0.0:${PORT}`);
  }
  console.log('\n💡 INSTRUCTIONS FOR MOBILE:');
  console.log('1. Open the Local URL in Chrome (Android) or Safari (iOS).');
  console.log('2. Tap "Add to Home Screen" to install as a standalone PWA.');
  console.log('3. Enjoy edge-to-edge algorithmic trading without a desktop!\n');
});

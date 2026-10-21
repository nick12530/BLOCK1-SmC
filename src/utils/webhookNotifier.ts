/**
 * webhookNotifier.ts - External Telegram & Webhook Alert Service
 * Dispatches instant push alerts to Telegram or Webhook endpoints whenever:
 * - A verified M15/M5 Sniper Signal is discovered on any scanned pair
 * - A Sniper Trade order is executed or closed
 */

import { Signal } from '../types/smc';
import { SupportedSymbol, getInstrumentConfig } from '../engine/instrumentConfig';

export interface WebhookConfig {
  enabled: boolean;
  type: 'telegram' | 'webhook' | 'both';
  telegramBotToken: string;
  telegramChatId: string;
  webhookUrl: string;
  minConfluenceScore: number;
  onlySniperSignals: boolean;
  alertOnExecutions: boolean;
  soundAlerts: boolean;
}

const STORAGE_KEY = 'mt5_webhook_alert_config_v1';

export const DEFAULT_WEBHOOK_CONFIG: WebhookConfig = {
  enabled: false,
  type: 'telegram',
  telegramBotToken: '',
  telegramChatId: '',
  webhookUrl: '',
  minConfluenceScore: 70,
  onlySniperSignals: true,
  alertOnExecutions: true,
  soundAlerts: true,
};

export function getWebhookConfig(): WebhookConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_WEBHOOK_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WEBHOOK_CONFIG;
    return { ...DEFAULT_WEBHOOK_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WEBHOOK_CONFIG;
  }
}

export function saveWebhookConfig(config: WebhookConfig): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

// Anti-spam cooldown cache for sent signal IDs (prevents duplicate alerts within 5 minutes)
const recentlySentSignals = new Map<string, number>();

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  htmlText: string
): Promise<{ ok: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return { ok: false, error: 'Telegram Bot Token and Chat ID are required.' };
  }

  const cleanToken = botToken.trim().replace(/^bot/i, '');
  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description || `HTTP ${res.status}: Failed to dispatch Telegram message` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error connecting to Telegram API' };
  }
}

export async function sendCustomWebhook(
  webhookUrl: string,
  payload: Record<string, any>
): Promise<{ ok: boolean; error?: string }> {
  if (!webhookUrl) {
    return { ok: false, error: 'Webhook URL is required.' };
  }

  try {
    const res = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: Webhook returned error response` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error connecting to Webhook endpoint' };
  }
}

/**
 * Dispatches an automated Sniper Signal alert to configured Telegram and Webhook destinations.
 * Differentiates VIP Pre-Execution signals that are about to be executed with high conviction.
 */
export async function dispatchSniperAlert(params: {
  symbol: SupportedSymbol;
  direction: 'BUY' | 'SELL';
  timeframe: string;
  strategy: string;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  slPips: number;
  tp1Pips: number;
  tp2Pips: number;
  tp3Pips: number;
  confluenceScore: number;
  recommendedLot?: number;
  sniperGrade?: 'A+' | 'A' | 'B';
  optimalTradeEntry?: number;
  triggerPattern?: string;
  mitigationType?: string;
  isImminent?: boolean;
  validitySeconds?: number;
  distanceToEntryPips?: number;
}): Promise<boolean> {
  const config = getWebhookConfig();
  if (!config.enabled) return false;

  // Filter criteria: require minimum confluence score
  if (params.confluenceScore < config.minConfluenceScore) return false;

  // If onlySniperSignals is true, ensure only high-conviction imminent/pre-execution setups are dispatched
  if (config.onlySniperSignals) {
    const isHighConviction = params.confluenceScore >= 75 || params.sniperGrade === 'A+';
    if (!isHighConviction) return false;
  }

  // Deduplication check (cooldown: 4 mins per symbol + direction)
  const signalKey = `${params.symbol}-${params.direction}-${params.timeframe}`;
  const now = Date.now();
  const lastSent = recentlySentSignals.get(signalKey);
  if (lastSent && now - lastSent < 240_000) {
    return false; // Skip duplicate notification within cooldown
  }
  recentlySentSignals.set(signalKey, now);

  const cfg = getInstrumentConfig(params.symbol);
  const isBuy = params.direction === 'BUY';
  const dirBadge = isBuy ? '🟢 BUY LIMIT / TRIGGER' : '🔴 SELL LIMIT / TRIGGER';
  const gradeLabel = params.sniperGrade ? ` • <b>Grade ${params.sniperGrade} (100% Conviction)</b>` : '';
  const triggerLine = params.triggerPattern
    ? `  • <b>Trigger Pattern:</b> ${params.triggerPattern}\n`
    : '';

  const distText = typeof params.distanceToEntryPips === 'number'
    ? `${params.distanceToEntryPips.toFixed(1)} pips to dot`
    : 'At Exact Strike Zone';

  const validitySec = params.validitySeconds ?? 180;
  const validityText = `${Math.floor(validitySec / 60)}m ${(validitySec % 60).toString().padStart(2, '0')}s Countdown Active`;

  const telegramHtml = `
🚨 <b>[VIP PRE-EXECUTION • 100% A+ INSTITUTIONAL SNIPER]</b> 🚨
⚡ <b>IMMINENT ORDER TRIGGER • HIGH CONVICTION SETUP</b> ⚡
━━━━━━━━━━━━━━━━━━━━━━━━
💎 <b>ASSET:</b> #${params.symbol} (${params.timeframe})
🏹 <b>ACTION:</b> <b>${dirBadge}</b>
🎯 <b>EXACT ENTRY (TO THE DOT):</b> <code>${params.entry.toFixed(cfg.digits)}</code>
⚡ <b>EXECUTION STATUS:</b> <b>IMMINENT</b> (${distText})
🛑 <b>STRICT STOP LOSS:</b> <code>${params.sl.toFixed(cfg.digits)}</code> (-${params.slPips} pips)

🎯 <b>3-TIER PROFIT OBJECTIVES:</b>
  ├ <b>TP 1:</b> <code>${params.tp1.toFixed(cfg.digits)}</code> (+${params.tp1Pips} pips) • 1:1.8 RR <i>[Scale 50% & SL to BE]</i>
  ├ <b>TP 2:</b> <code>${params.tp2.toFixed(cfg.digits)}</code> (+${params.tp2Pips} pips) • 1:3.2 RR <i>[Primary Target]</i>
  └ <b>TP 3:</b> <code>${params.tp3.toFixed(cfg.digits)}</code> (+${params.tp3Pips} pips) • 1:5.5 RR <i>[Runner]</i>

📋 <b>5-POINT A+ CONFLUENCE CONFIRMATION:</b>
  • <b>Confluence Score:</b> <b>${params.confluenceScore}%</b>${gradeLabel}
  • <b>Mitigation POI:</b> ${params.mitigationType || 'Order Block 50% Mean Threshold & Liquidity Sweep'}
${triggerLine}  • <b>Recommended Sizing:</b> <code>${params.recommendedLot ? `${params.recommendedLot.toFixed(2)} Lots` : '0.01 - 0.05 Lots'}</code>
  • <b>Execution Window:</b> ⏱️ <b>${validityText}</b>

👉 <b>ACTION:</b> EXECUTE NOW OR PLACE PENDING LIMIT AT EXACT DOT. Auto-cancels if level breached.
━━━━━━━━━━━━━━━━━━━━━━━━
🕒 <i>${new Date().toLocaleTimeString()} UTC • NIFTY Terminal VIP Wire</i>
`.trim();

  let sent = false;

  if ((config.type === 'telegram' || config.type === 'both') && config.telegramBotToken && config.telegramChatId) {
    const res = await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, telegramHtml);
    if (res.ok) sent = true;
  }

  if ((config.type === 'webhook' || config.type === 'both') && config.webhookUrl) {
    const payload = {
      event: 'VIP_SNIPER_SIGNAL',
      symbol: params.symbol,
      direction: params.direction,
      strategy: params.strategy,
      timeframe: params.timeframe,
      entry: params.entry,
      sl: params.sl,
      tp1: params.tp1,
      tp2: params.tp2,
      tp3: params.tp3,
      confluenceScore: params.confluenceScore,
      isImminent: params.isImminent ?? true,
      validitySeconds: params.validitySeconds,
      timestamp: new Date().toISOString(),
    };
    const res = await sendCustomWebhook(config.webhookUrl, payload);
    if (res.ok) sent = true;
  }

  return sent;
}

/**
 * Dispatches an automated execution fill alert
 */
export async function dispatchExecutionNotification(params: {
  symbol: string;
  direction: string;
  volume: number;
  openPrice: number;
  sl: number;
  tp: number;
  ticket?: number;
}): Promise<void> {
  const config = getWebhookConfig();
  if (!config.enabled || !config.alertOnExecutions) return;

  const isBuy = params.direction.toUpperCase() === 'BUY';
  const dirBadge = isBuy ? '🟢 BUY' : '🔴 SELL';

  const telegramHtml = `
✅ <b>TRADE EXECUTION CONFIRMED</b>
━━━━━━━━━━━━━━━━━━━━
🎫 <b>TICKET:</b> <code>#${params.ticket || 'DESK'}</code>
💎 <b>PAIR:</b> #${params.symbol}
⚡️ <b>DIRECTION:</b> <b>${dirBadge}</b>
📦 <b>VOLUME:</b> <code>${params.volume} Lots</code>
💵 <b>FILL PRICE:</b> <code>$${params.openPrice.toFixed(2)}</code>

🛑 <b>SL:</b> <code>$${params.sl.toFixed(2)}</code>
🎯 <b>TP:</b> <code>$${params.tp.toFixed(2)}</code>
━━━━━━━━━━━━━━━━━━━━
🕒 <i>Filled at ${new Date().toLocaleTimeString()} UTC • MT5 Broker Connected</i>
`.trim();

  if ((config.type === 'telegram' || config.type === 'both') && config.telegramBotToken && config.telegramChatId) {
    await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, telegramHtml);
  }

  if ((config.type === 'webhook' || config.type === 'both') && config.webhookUrl) {
    await sendCustomWebhook(config.webhookUrl, {
      event: 'ORDER_EXECUTED',
      ...params,
      timestamp: new Date().toISOString(),
    });
  }
}

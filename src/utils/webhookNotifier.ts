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
  alertOnApproachingEntry: boolean;
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
  minConfluenceScore: 88,
  onlySniperSignals: true,
  alertOnApproachingEntry: true,
  alertOnExecutions: true,
  soundAlerts: true,
};

export function getWebhookConfig(): WebhookConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_WEBHOOK_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WEBHOOK_CONFIG;
    const stored = JSON.parse(raw) as Partial<WebhookConfig>;
    const minConfluenceScore = Number(stored.minConfluenceScore);
    return {
      ...DEFAULT_WEBHOOK_CONFIG,
      ...stored,
      minConfluenceScore: Number.isFinite(minConfluenceScore)
        ? Math.min(100, Math.max(88, minConfluenceScore))
        : DEFAULT_WEBHOOK_CONFIG.minConfluenceScore,
    };
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
const recentlySentApproachingEntries = new Map<string, number>();

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
    let finalBody: Record<string, any> = payload;

    // Discord Webhook auto-adapter
    if (webhookUrl.includes('discord.com/api/webhooks')) {
      const isBuy = payload.direction === 'BUY';
      const color = isBuy ? 0x00E676 : 0xFF5252;
      const eventName = payload.event || 'SMC Signal Alert';
      finalBody = {
        content: `⚡ **NIFTY Institutional Trading Alert**`,
        embeds: [
          {
            title: `${payload.symbol || 'MARKET'} ${payload.direction || ''} · ${payload.strategy || eventName}`,
            description: payload.message || `Confluence Score: **${payload.confluenceScore || '—'}**/100`,
            color,
            fields: [
              ...(payload.entry !== undefined ? [{ name: 'Entry', value: `\`${payload.entry}\``, inline: true }] : []),
              ...(payload.sl !== undefined ? [{ name: 'Stop Loss', value: `\`${payload.sl}\``, inline: true }] : []),
              ...(payload.tp1 !== undefined || payload.tp !== undefined ? [{ name: 'Target', value: `\`${payload.tp1 || payload.tp}\``, inline: true }] : []),
              ...(payload.volume !== undefined ? [{ name: 'Volume', value: `\`${payload.volume}L\``, inline: true }] : []),
            ],
            footer: { text: 'NIFTY Trading Engine · Risk Guardrails Active' },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }

    const res = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalBody),
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
 * Dispatches an automated Sniper Signal alert to configured Telegram and Webhook destinations
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
  validUntil: number;
}): Promise<boolean> {
  const config = getWebhookConfig();
  if (!config.enabled) return false;

  // Filter criteria
  if (
    params.confluenceScore < Math.max(88, config.minConfluenceScore) ||
    params.sniperGrade !== 'A+' ||
    !params.optimalTradeEntry ||
    params.validUntil <= Date.now()
  ) {
    return false;
  }

  // Deduplication check (cooldown: 5 mins per symbol + direction)
  const signalKey = `${params.symbol}-${params.direction}-${params.timeframe}`;
  const now = Date.now();
  const lastSent = recentlySentSignals.get(signalKey);
  if (lastSent && now - lastSent < 300_000) {
    return false; // Skip duplicate notification within 5 mins
  }
  recentlySentSignals.set(signalKey, now);
  const cfg = getInstrumentConfig(params.symbol);
  const isBuy = params.direction === 'BUY';
  const dirBadge = isBuy ? '🟢 BUY SETUP' : '🔴 SELL SETUP';
  const gradeLabel = params.sniperGrade ? ` • <b>Grade ${params.sniperGrade}</b>` : '';
  const oteLine = `  • <b>OTE Entry Trigger:</b> <code>${params.optimalTradeEntry.toFixed(cfg.digits)}</code>\n`;
  const triggerLine = params.triggerPattern
    ? `  • <b>Trigger Pattern:</b> ${params.triggerPattern}\n`
    : '';
  const validUntil = new Date(params.validUntil).toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const telegramHtml = `
⚡️ <b>PRECISION ENTRY ALERT</b> ⚡️
━━━━━━━━━━━━━━━━━━━━━━━━
💎 <b>PAIR:</b> #${params.symbol}
🎯 <b>SETUP:</b> <b>${dirBadge}</b>
📊 <b>TIMEFRAME:</b> ${params.timeframe}  |  <b>CONFLUENCE:</b> ${params.confluenceScore}/100${gradeLabel}

📍 <b>CURRENT QUOTE:</b> <code>${params.entry.toFixed(cfg.digits)}</code>
${oteLine}🛑 <b>STOP LOSS:</b> <code>${params.sl.toFixed(cfg.digits)}</code> (-${params.slPips} pips)

🎯 <b>TARGET OBJECTIVES:</b>
  ├ <b>TP 1:</b> <code>${params.tp1.toFixed(cfg.digits)}</code> (+${params.tp1Pips} pips) • 1:1.8 RR
  ├ <b>TP 2:</b> <code>${params.tp2.toFixed(cfg.digits)}</code> (+${params.tp2Pips} pips) • 1:3.2 RR <i>[Recommended]</i>
  └ <b>TP 3:</b> <code>${params.tp3.toFixed(cfg.digits)}</code> (+${params.tp3Pips} pips) • 1:5.5 RR <i>[Runner]</i>

🛡 <b>RISK MANAGEMENT:</b>
  • <b>Setup:</b> ${params.strategy}
${triggerLine}  • <b>Suggested Sizing:</b> <code>${params.recommendedLot ? `${params.recommendedLot.toFixed(2)} Lots` : '0.01 - 0.05 Lots'}</code>
  • <b>Trade Rule:</b> Move Stop Loss to Break-Even (BE) once TP1 is secured
━━━━━━━━━━━━━━━━━━━━━━━━
⏳ <b>Entry window closes:</b> ${validUntil} UTC
⚠️ <i>High-confluence setup, not a guarantee of profit. Confirm the live quote and risk before execution.</i>
🕒 <i>${new Date(now).toLocaleTimeString('en-GB', { timeZone: 'UTC' })} UTC • NIFTY Terminal</i>
`.trim();

  let sent = false;

  if ((config.type === 'telegram' || config.type === 'both') && config.telegramBotToken && config.telegramChatId) {
    const res = await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, telegramHtml);
    if (res.ok) sent = true;
  }

  if ((config.type === 'webhook' || config.type === 'both') && config.webhookUrl) {
    const payload = {
      event: 'SNIPER_SIGNAL',
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
      setupType: 'PRECISION_ENTRY',
      optimalTradeEntry: params.optimalTradeEntry,
      validUntil: new Date(params.validUntil).toISOString(),
      timestamp: new Date().toISOString(),
    };
    const res = await sendCustomWebhook(config.webhookUrl, payload);
    if (res.ok) sent = true;
  }

  if (!sent) recentlySentSignals.delete(signalKey);
  return sent;
}

export async function dispatchApproachingEntryAlert(params: {
  symbol: SupportedSymbol;
  direction: 'BUY' | 'SELL';
  timeframe: string;
  entry: number;
  optimalTradeEntry: number;
  sl: number;
  tp: number;
  confluenceScore: number;
  validUntil: number;
}): Promise<boolean> {
  const config = getWebhookConfig();
  if (
    !config.enabled ||
    !config.alertOnApproachingEntry ||
    params.confluenceScore < Math.max(88, config.minConfluenceScore) ||
    params.validUntil <= Date.now()
  ) {
    return false;
  }

  const signalKey = `${params.symbol}-${params.direction}-${params.timeframe}`;
  const now = Date.now();
  const lastSent = recentlySentApproachingEntries.get(signalKey);
  if (lastSent && now - lastSent < 300_000) return false;
  recentlySentApproachingEntries.set(signalKey, now);
  if (recentlySentApproachingEntries.size > 128) {
    for (const [key, timestamp] of recentlySentApproachingEntries) {
      if (now - timestamp > 3_600_000) recentlySentApproachingEntries.delete(key);
    }
  }

  const cfg = getInstrumentConfig(params.symbol);
  const validUntil = new Date(params.validUntil).toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const message = `
<b>ENTRY TRIGGER APPROACHING — NOT EXECUTED</b>
<b>${params.symbol} ${params.direction}</b> · ${params.timeframe} · Confluence ${params.confluenceScore}/100
Current quote: <code>${params.entry.toFixed(cfg.digits)}</code>
Trigger zone: <code>${params.optimalTradeEntry.toFixed(cfg.digits)}</code>
Stop: <code>${params.sl.toFixed(cfg.digits)}</code> · Target: <code>${params.tp.toFixed(cfg.digits)}</code>
Entry window closes: ${validUntil} UTC
Wait for the stated trigger and re-check the live quote, spread, and risk. This is not an order or a profit guarantee.
`.trim();

  let sent = false;
  if ((config.type === 'telegram' || config.type === 'both') && config.telegramBotToken && config.telegramChatId) {
    const result = await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, message);
    sent = sent || result.ok;
  }
  if ((config.type === 'webhook' || config.type === 'both') && config.webhookUrl) {
    const result = await sendCustomWebhook(config.webhookUrl, {
      event: 'ENTRY_TRIGGER_APPROACHING',
      ...params,
      timestamp: new Date(now).toISOString(),
      message,
    });
    sent = sent || result.ok;
  }
  if (!sent) recentlySentApproachingEntries.delete(signalKey);
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

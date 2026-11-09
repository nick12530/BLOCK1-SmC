/**
 * MacroSentimentRadar.tsx - Refined Minimalist Macro & Real-Time News Deck
 * De-cluttered:
 * - Clean horizontal overview ribbon (Regime, RVOL, DXY, VIX)
 * - Organized tabbed deck for in-depth data: Real-Time News, Economic Calendar, Volume Flow
 * - Uncrowded, airy presentation with zero badge sandwiching
 */

import React, { useState, useMemo } from 'react';
import {
  Globe,
  Radio,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTicker, useMarket, useMacroSentiment } from '../hooks/useTradingStore';
import { SupportedSymbol, getInstrumentConfig } from '../engine/instrumentConfig';
import { newsSentimentEngine } from '../engine/newsSentimentEngine';
import { calculateRVOL } from '../engine/volumeEngine';
import { NewsSentimentItem, EconomicEvent } from '../types/smc';

type ActiveTab = 'news' | 'calendar' | 'volume';

export const MacroSentimentRadar: React.FC = React.memo(() => {
  const ticker = useTicker();
  const market = useMarket();
  const macro = useMacroSentiment();
  const activeSymbol = (ticker.symbol || 'XAUUSD') as SupportedSymbol;
  const cfg = getInstrumentConfig(activeSymbol);

  const [activeTab, setActiveTab] = useState<ActiveTab>('news');
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);
  const [customHeadline, setCustomHeadline] = useState('');
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Compute live RVOL from current active candles
  const currentCandles = market.candlesM5.length >= 10 ? market.candlesM5 : market.candlesM1;
  const volumeMetrics = useMemo(() => {
    return calculateRVOL(currentCandles, 20);
  }, [currentCandles]);

  const intermarket = macro?.intermarket ?? {
    dxyBias: 'neutral' as const,
    dxyChangePct: 0.05,
    vixLevel: 14.8,
    vixRegime: 'CALM' as const,
    riskRegime: 'RISK_ON' as const,
    goldDriver: 'Neutral Intermarket Flows',
    recommendedStopBuffer: 1.0,
  };

  const handleRefreshLiveNews = async () => {
    setIsRefreshingNews(true);
    try {
      await newsSentimentEngine.fetchLiveNews();
    } finally {
      setIsRefreshingNews(false);
    }
  };

  const handleAddCustomNews = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customHeadline.trim() || isSubmittingCustom) return;
    setIsSubmittingCustom(true);
    try {
      const scored = newsSentimentEngine.scoreHeadline(customHeadline.trim());
      newsSentimentEngine.addHeadline({
        title: customHeadline.trim(),
        source: 'Institutional Desk',
        sentimentScore: scored.score,
        urgency: 'BREAKING',
        catalystType: scored.catalyst,
        affectedAssets: [activeSymbol, 'USD'],
        summary: `Manual macro catalyst ingested into desk radar.`,
      });
      setCustomHeadline('');
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  return (
    <div className="w-full border border-slate-200 dark:border-[#222d29] rounded-xl px-4 py-3 bg-white dark:bg-[#121917] font-mono text-xs transition-colors space-y-3">
      {/* 1. Header & Summary Strip */}
      <div className="flex items-center justify-between pb-1 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-500" />
          <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Macro &amp; Live News Radar
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            · {intermarket.riskRegime === 'RISK_OFF' ? 'Risk-Off Safe Haven' : 'Risk-On Liquidity'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshLiveNews}
            disabled={isRefreshingNews}
            className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-[#222d29] text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1a2320] transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh live financial headlines from feed"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshingNews ? 'animate-spin text-sky-500' : ''}`} />
            <span>{isRefreshingNews ? 'Syncing...' : 'Fetch News'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse Deck' : 'Expand Details'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Overview Metric Bar: 4 Clean Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-xs">
        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513]">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Regime</span>
          <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
            {intermarket.riskRegime === 'RISK_OFF' ? 'Risk-Off Safe Haven' : 'Risk-On Liquidity'}
          </span>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513]">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">RVOL ({activeSymbol})</span>
          <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
            {volumeMetrics.rvol}x · {volumeMetrics.volumeType}
          </span>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513]">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">DXY Dollar</span>
          <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
            {intermarket.dxyBias.toUpperCase()} ({intermarket.dxyChangePct >= 0 ? `+${intermarket.dxyChangePct}%` : `${intermarket.dxyChangePct}%`})
          </span>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513]">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">VIX Volatility</span>
          <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
            {intermarket.vixLevel} pts · {intermarket.vixRegime}
          </span>
        </div>
      </div>

      {/* 3. In-Depth Tabbed Deck (Expands cleanly without crowding) */}
      {isExpanded && (
        <div className="pt-2 space-y-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-[#222d29] pb-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('news')}
              className={`py-1.5 px-3 rounded-md transition-colors cursor-pointer ${
                activeTab === 'news'
                  ? 'bg-slate-100 dark:bg-[#1a2320] text-slate-900 dark:text-white font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Real-Time Financial News ({macro?.newsItems.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`py-1.5 px-3 rounded-md transition-colors cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-slate-100 dark:bg-[#1a2320] text-slate-900 dark:text-white font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Economic Calendar ({macro?.economicEvents.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('volume')}
              className={`py-1.5 px-3 rounded-md transition-colors cursor-pointer ${
                activeTab === 'volume'
                  ? 'bg-slate-100 dark:bg-[#1a2320] text-slate-900 dark:text-white font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Order Flow Footprint
            </button>
          </div>

          {/* Tab 1: Real-Time Financial News */}
          {activeTab === 'news' && (
            <div className="space-y-2">
              <form onSubmit={handleAddCustomNews} className="flex gap-2">
                <input
                  type="text"
                  value={customHeadline}
                  onChange={(e) => setCustomHeadline(e.target.value)}
                  placeholder="Paste breaking news headline or geopolitical shock..."
                  className="flex-1 bg-slate-50 dark:bg-[#0f1513] border border-slate-200 dark:border-[#222d29] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!customHeadline.trim() || isSubmittingCustom}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  Add Headline
                </button>
              </form>

              <div className="divide-y divide-slate-100 dark:divide-[#222d29] max-h-72 overflow-y-auto">
                {macro?.newsItems && macro.newsItems.length > 0 ? (
                  macro.newsItems.map((item: NewsSentimentItem) => (
                    <div key={item.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{item.title}</span>
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5 text-[11px]"
                            >
                              <span>Read</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                          <span>{item.source}</span>
                          <span>·</span>
                          <span>{item.publishedAt}</span>
                          <span>·</span>
                          <span className={item.sentimentScore > 0 ? 'text-emerald-500 font-bold' : item.sentimentScore < 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}>
                            {item.sentimentScore > 0 ? `+${(item.sentimentScore * 100).toFixed(0)} Bullish` : item.sentimentScore < 0 ? `${(item.sentimentScore * 100).toFixed(0)} Bearish` : 'Neutral'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-slate-400">No headlines ingested. Click &apos;Fetch News&apos; to load live RSS feed.</div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Economic Calendar */}
          {activeTab === 'calendar' && (
            <div className="space-y-2">
              <div className="divide-y divide-slate-100 dark:divide-[#222d29] max-h-72 overflow-y-auto">
                {macro?.economicEvents && macro.economicEvents.length > 0 ? (
                  macro.economicEvents.map((event: EconomicEvent) => (
                    <div key={event.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{event.event}</div>
                        <div className="text-[11px] text-slate-400">
                          {event.currency} · Forecast: {event.forecast} · Previous: {event.previous}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-600 dark:text-slate-300">
                          {event.time}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-slate-400">No high-impact macro surprises recorded for this session.</div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Order Flow Footprint */}
          {activeTab === 'volume' && (
            <div className="p-3 rounded-lg border border-slate-200 dark:border-[#222d29] bg-slate-50/50 dark:bg-[#0f1513] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Relative Volume (RVOL):</span>
                <span className="font-bold text-slate-900 dark:text-white">{volumeMetrics.rvol}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Volume Footprint Type:</span>
                <span className="font-bold text-slate-900 dark:text-white">{volumeMetrics.volumeType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cumulative Volume Delta (CVD):</span>
                <span className="font-bold text-slate-900 dark:text-white">{volumeMetrics.cvdDelta > 0 ? `+${volumeMetrics.cvdDelta}` : volumeMetrics.cvdDelta}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Point of Control (POC):</span>
                <span className="font-bold text-slate-900 dark:text-white">${volumeMetrics.pocPrice || 'Tracking...'}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

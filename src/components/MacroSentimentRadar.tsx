/**
 * MacroSentimentRadar.tsx - Institutional Macro, News Sentiment & Volume Order Flow Radar
 *
 * Integrates:
 * 1. Global Macro Regime (Risk-On / Risk-Off, VIX Volatility Level, DXY Dollar Index)
 * 2. Institutional Relative Volume (RVOL) & Volume Footprint (Displacement vs Absorption)
 * 3. Macroeconomic Calendar Surprises (Actual vs. Forecast with Surprise Deltas)
 * 4. Streaming Financial News & Geopolitical Shock Feed with Gemini NLP Sentiment
 * 5. Intermarket Correlation Matrix with Dynamic Stop-Loss Multipliers
 */

import React, { useState, useMemo } from 'react';
import {
  Globe,
  Radio,
  TrendingUp,
  TrendingDown,
  Volume2,
  Sparkles,
  AlertTriangle,
  Flame,
  Shield,
  Layers,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useMacroSentiment, useMarket, useTicker } from '../hooks/useTradingStore';
import { newsSentimentEngine } from '../engine/newsSentimentEngine';
import { calculateRVOL } from '../engine/volumeEngine';
import { SupportedSymbol, getInstrumentConfig } from '../engine/instrumentConfig';
import { NewsSentimentItem } from '../types/smc';

interface MacroSentimentRadarProps {
  compact?: boolean;
}

export const MacroSentimentRadar: React.FC<MacroSentimentRadarProps> = ({ compact = false }) => {
  const ticker = useTicker();
  const market = useMarket();
  const macro = useMacroSentiment();

  const [activeTab, setActiveTab] = useState<'news' | 'calendar' | 'volume' | 'intermarket'>('news');
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [geminiAnalysis, setGeminiAnalysis] = useState<{ id: string; text: string; score: number } | null>(null);
  const [customHeadline, setCustomHeadline] = useState('');
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  const activeSymbol = (ticker.symbol || 'XAUUSD') as SupportedSymbol;
  const cfg = getInstrumentConfig(activeSymbol);

  // Compute live RVOL from current active candles
  const currentCandles = market.candlesM5.length >= 10 ? market.candlesM5 : market.candlesM1;
  const volumeMetrics = useMemo(() => {
    return calculateRVOL(currentCandles, 20);
  }, [currentCandles]);

  // Pair specific sentiment
  const pairSentiment = useMemo(() => {
    return newsSentimentEngine.evaluatePairSentiment(activeSymbol);
  }, [activeSymbol, macro?.newsItems]);

  const intermarket = macro?.intermarket || {
    dxyBias: 'bullish' as const,
    dxyChangePct: 0.28,
    vixLevel: 16.4,
    vixRegime: 'CALM' as const,
    riskRegime: 'RISK_OFF' as const,
    goldDriver: 'Safe-Haven Geopolitical Flows',
    recommendedStopBuffer: 1.0,
  };

  const sentimentScore = macro?.globalSentimentScore ?? 25;
  const sentimentLabel = macro?.globalSentimentLabel ?? 'BULLISH';

  const handleAnalyzeWithGemini = async (item: NewsSentimentItem) => {
    setAnalyzingId(item.id);
    try {
      const res = await newsSentimentEngine.analyzeWithGemini(item.title);
      setGeminiAnalysis({
        id: item.id,
        text: res.summary,
        score: res.score,
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleAddCustomHeadline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customHeadline.trim()) return;
    setIsSubmittingCustom(true);
    try {
      const scored = newsSentimentEngine.scoreHeadline(customHeadline.trim());
      newsSentimentEngine.addHeadline({
        title: customHeadline.trim(),
        source: 'User Intelligence Desk',
        sentimentScore: scored.score,
        urgency: 'BREAKING',
        catalystType: scored.catalyst,
        affectedAssets: [activeSymbol, 'USD'],
        summary: `Manual macro catalyst ingested into institutional radar.`,
      });
      setCustomHeadline('');
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  return (
    <div className="neo-panel neo-card w-full border rounded-2xl p-4 sm:p-5 font-mono text-xs transition-colors space-y-4">
      {/* 1. Header Banner & Quick Telemetry Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20">
            <Globe className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Institutional Macro & News Sentiment Radar
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-ping" />
                Live Feed
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Macro Surprises, Breaking Geopolitical Sentiment & Order Flow RVOL for{' '}
              <span className="font-semibold text-slate-800 dark:text-zinc-200">{cfg.displayName} ({activeSymbol})</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Regime Pill */}
          <div className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 ${
            intermarket.riskRegime === 'RISK_OFF'
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          }`}>
            <Shield className="w-3.5 h-3.5" />
            <span>{intermarket.riskRegime.replace('_', ' ')}</span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title={isExpanded ? 'Collapse radar panel' : 'Expand radar panel'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Top Metric Matrix (Always Visible) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Global Sentiment Gauge */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800/80">
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 mb-1">
            <span>Global Macro Index</span>
            <span className="font-bold text-slate-700 dark:text-zinc-300">{sentimentScore > 0 ? `+${sentimentScore}` : sentimentScore}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-extrabold ${
              sentimentScore >= 20 ? 'text-emerald-500' : sentimentScore <= -20 ? 'text-rose-500' : 'text-amber-500'
            }`}>
              {sentimentLabel.replace('_', ' ')}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                sentimentScore >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(10, (Math.abs(sentimentScore) / 100) * 100))}%` }}
            />
          </div>
        </div>

        {/* Relative Volume & Footprint */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800/80">
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 mb-1">
            <span>Volume Footprint</span>
            <span className="font-bold text-slate-700 dark:text-zinc-300">{volumeMetrics.rvol}x RVOL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Flame className={`w-3.5 h-3.5 ${
              volumeMetrics.rvol >= 1.8 ? 'text-amber-500 animate-bounce' : 'text-slate-400'
            }`} />
            <span className={`text-sm font-extrabold ${
              volumeMetrics.volumeType === 'DISPLACEMENT'
                ? 'text-indigo-400'
                : volumeMetrics.volumeType === 'ABSORPTION'
                ? 'text-amber-400'
                : volumeMetrics.volumeType === 'LOW_LIQUIDITY'
                ? 'text-slate-400'
                : 'text-slate-200'
            }`}>
              {volumeMetrics.volumeType}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1.5 flex items-center justify-between">
            <span>CVD Delta: {volumeMetrics.cvdDelta > 0 ? `+${volumeMetrics.cvdDelta}` : volumeMetrics.cvdDelta}</span>
            <span>POC: ${volumeMetrics.pocPrice || '—'}</span>
          </div>
        </div>

        {/* DXY Dollar Index Trend */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800/80">
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 mb-1">
            <span>DXY Dollar Index</span>
            <span className={`font-bold ${intermarket.dxyChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {intermarket.dxyChangePct >= 0 ? `+${intermarket.dxyChangePct}%` : `${intermarket.dxyChangePct}%`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {intermarket.dxyBias === 'bullish' ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : intermarket.dxyBias === 'bearish' ? (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="text-sm font-extrabold uppercase">
              USD {intermarket.dxyBias}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1.5 truncate">
            {activeSymbol === 'XAUUSD' || activeSymbol === 'EURUSD'
              ? intermarket.dxyBias === 'bullish' ? '⚠️ Headwind for BUY' : '⚡ Tailwind for BUY'
              : 'Intermarket aligned'}
          </p>
        </div>

        {/* VIX Market Volatility */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800/80">
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 mb-1">
            <span>VIX Volatility Regime</span>
            <span className="font-bold text-slate-700 dark:text-zinc-300">{intermarket.vixLevel} pts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-extrabold px-1.5 py-0.5 rounded ${
              intermarket.vixRegime === 'CRISIS'
                ? 'bg-rose-500/20 text-rose-400'
                : intermarket.vixRegime === 'ELEVATED'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {intermarket.vixRegime}
            </span>
            <span className="text-[10px] text-slate-400">({intermarket.recommendedStopBuffer}x SL)</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1.5 truncate">
            {intermarket.vixRegime === 'CALM'
              ? 'Clean SMC Technicals'
              : 'Dynamic ATR Stop Buffer Active'}
          </p>
        </div>
      </div>

      {/* 3. Expandable Deep Intelligence Workspace */}
      {isExpanded && (
        <div className="space-y-3 pt-2">
          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] font-semibold">
            <button
              onClick={() => setActiveTab('news')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'news'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Radio className="w-3 h-3 text-indigo-400" />
              <span>Breaking News & Catalysts ({macro?.newsItems.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'calendar'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Economic Surprises ({macro?.economicEvents.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('volume')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'volume'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Flame className="w-3 h-3 text-rose-400" />
              <span>Institutional Order Flow</span>
            </button>

            <button
              onClick={() => setActiveTab('intermarket')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'intermarket'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3 text-emerald-400" />
              <span>Intermarket Matrix</span>
            </button>
          </div>

          {/* TAB 1: BREAKING NEWS & HEADLINES */}
          {activeTab === 'news' && (
            <div className="space-y-3">
              {/* Manual Headline Injection Bar */}
              <form onSubmit={handleAddCustomHeadline} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={customHeadline}
                    onChange={(e) => setCustomHeadline(e.target.value)}
                    placeholder="Enter breaking headline or geopolitical alert (e.g. 'OPEC announces unexpected crude supply cut')..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!customHeadline.trim() || isSubmittingCustom}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors disabled:opacity-50 shrink-0"
                >
                  Analyze & Inject
                </button>
              </form>

              {/* Headline Stream */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {(macro?.newsItems || []).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            item.urgency === 'FLASH'
                              ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30 animate-pulse'
                              : item.urgency === 'BREAKING'
                              ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                              : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                          }`}>
                            {item.urgency}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-zinc-800 text-[10px] font-bold text-slate-600 dark:text-zinc-400">
                            {item.catalystType}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                            {item.source} · {new Date(item.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 className="font-semibold text-xs text-slate-900 dark:text-zinc-100 leading-snug">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                          {item.summary}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className={`px-2 py-1 rounded-lg text-xs font-black ${
                          item.sentimentScore > 0
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : item.sentimentScore < 0
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}>
                          {item.sentimentScore > 0 ? `+${(item.sentimentScore * 100).toFixed(0)}%` : `${(item.sentimentScore * 100).toFixed(0)}%`}
                        </div>

                        <button
                          onClick={() => void handleAnalyzeWithGemini(item)}
                          disabled={analyzingId === item.id}
                          className="px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          <Sparkles className={`w-3 h-3 ${analyzingId === item.id ? 'animate-spin' : ''}`} />
                          <span>{analyzingId === item.id ? 'Analyzing...' : 'Gemini AI'}</span>
                        </button>
                      </div>
                    </div>

                    {geminiAnalysis?.id === item.id && (
                      <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/30 text-indigo-200 text-[11px] space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-indigo-400">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Gemini Institutional Synthesis</span>
                        </div>
                        <p>{geminiAnalysis.text}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: ECONOMIC SURPRISES & CALENDAR DELTAS */}
          {activeTab === 'calendar' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 pb-1">
                <span>Event / Currency</span>
                <div className="flex items-center gap-6">
                  <span>Actual / Forecast</span>
                  <span>Macro Surprise</span>
                </div>
              </div>

              {(macro?.economicEvents || []).length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-800 text-center text-slate-500 dark:text-zinc-400 text-xs">
                  No pending or recent high-impact macroeconomic releases for current currency pairs.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(macro?.economicEvents || []).map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 font-bold text-[10px] text-slate-700 dark:text-zinc-300">
                            {ev.currency}
                          </span>
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {ev.event}
                          </span>
                          <span className={`text-[10px] font-bold ${
                            ev.impact === 'high' ? 'text-rose-400' : 'text-amber-400'
                          }`}>
                            [{ev.impact.toUpperCase()}]
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                          {ev.minutesRemaining > 0
                            ? `Releases in ${ev.minutesRemaining}m`
                            : `Printed ${Math.abs(ev.minutesRemaining)}m ago`}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                            Act: {ev.actual || '—'} / Est: {ev.forecast}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                            Prev: {ev.previous}
                          </div>
                        </div>

                        <span className={`px-2 py-1 rounded-lg text-[11px] font-black uppercase ${
                          ev.surpriseDirection === 'BULLISH'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : ev.surpriseDirection === 'BEARISH'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : ev.surpriseDirection === 'INLINE'
                            ? 'bg-zinc-800 text-zinc-300'
                            : 'bg-zinc-800/50 text-zinc-500'
                        }`}>
                          {ev.surpriseDirection || 'PENDING'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INSTITUTIONAL ORDER FLOW & RVOL */}
          {activeTab === 'volume' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-zinc-200">RVOL Institutional Multiplier</span>
                  <span className="text-xs font-extrabold text-indigo-400">{volumeMetrics.rvol}x</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  {volumeMetrics.rvol >= 2.0
                    ? '⚡ Institutional Climax: Volume is over 200% of rolling 20-period baseline. High-probability continuation or exhaustion absorption.'
                    : volumeMetrics.rvol >= 1.4
                    ? 'Confirmed Institutional Flow: Adequate liquidity for clean SMC mitigation entries.'
                    : 'Low Volume Retail Chop: Sub-baseline volume. Watch for liquidity sweeps and fakeouts.'}
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px]">
                  <span className="text-slate-400">Current Volume:</span>
                  <span className="font-bold text-white">{volumeMetrics.currentVolume.toLocaleString()}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400">20-Bar Baseline:</span>
                  <span className="font-bold text-white">{volumeMetrics.avgVolume20.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-zinc-200">Volume Footprint Type</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    {volumeMetrics.volumeType}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  {volumeMetrics.volumeType === 'DISPLACEMENT'
                    ? 'Displacement Body: Expansion candle body exceeds 50% of range with high volume, confirming directional order flow.'
                    : volumeMetrics.volumeType === 'ABSORPTION'
                    ? 'Absorption Wick: Large rejection wick with high volume indicates smart money absorbing all incoming market orders.'
                    : 'Neutral / Standard Order Flow without acute institutional anomaly.'}
                </p>
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-slate-400">Point of Control (POC):</span>
                  <span className="font-bold text-amber-400">${volumeMetrics.pocPrice || '—'}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INTERMARKET CORRELATION */}
          {activeTab === 'intermarket' && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-zinc-200">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Macro Asset Correlation Dashboard</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Adaptive SL Buffer: <strong className="text-white">{intermarket.recommendedStopBuffer}x ATR</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/60 space-y-1">
                  <div className="text-[10px] text-slate-400">USD Dollar Index (DXY)</div>
                  <div className="text-sm font-extrabold text-slate-100">{intermarket.dxyBias.toUpperCase()}</div>
                  <div className="text-[10px] text-slate-500">Weight: 57.6% EUR, 13.6% JPY, 11.9% GBP</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/60 space-y-1">
                  <div className="text-[10px] text-slate-400">Volatility Regime (VIX)</div>
                  <div className="text-sm font-extrabold text-amber-400">{intermarket.vixRegime} ({intermarket.vixLevel})</div>
                  <div className="text-[10px] text-slate-500">Buffer: {intermarket.recommendedStopBuffer}x ATR padding</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/60 space-y-1">
                  <div className="text-[10px] text-slate-400">Gold Safe-Haven Catalyst</div>
                  <div className="text-xs font-bold text-slate-200 truncate">{intermarket.goldDriver}</div>
                  <div className="text-[10px] text-slate-500">Risk-off capital rotation</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * newsSentimentEngine.ts - Real-Time News & Geopolitical Sentiment Engine
 *
 * Ingests financial headlines, geopolitical shocks, and central bank commentary.
 * Uses fast rule-based NLP + optional Gemini API integration (@google/genai)
 * to score sentiment from -1.0 (strongly bearish) to +1.0 (strongly bullish),
 * categorize catalyst types, and evaluate asset-specific sentiment bias.
 */

import { NewsSentimentItem } from '../types/smc';
import { SupportedSymbol } from './instrumentConfig';
import { GoogleGenAI } from '@google/genai';

// Pre-seeded high-impact institutional headlines representing current market catalysts
export const INITIAL_HEADLINES: NewsSentimentItem[] = [
  {
    id: 'news-1',
    title: 'Federal Reserve Reiterates Data-Dependent Path as Core Inflation Stays Sticky',
    source: 'Bloomberg Macro',
    publishedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    sentimentScore: 0.45,
    urgency: 'BREAKING',
    catalystType: 'CENTRAL_BANK',
    affectedAssets: ['USD', 'XAUUSD', 'EURUSD'],
    summary: 'Fed officials signal rates may remain elevated longer to combat persistent services inflation, supporting the US dollar index.',
  },
  {
    id: 'news-2',
    title: 'Middle East Geopolitical Tensions Escalate; Safe-Haven Inflows Drive Gold Bid',
    source: 'Reuters Financial',
    publishedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    sentimentScore: 0.75,
    urgency: 'FLASH',
    catalystType: 'GEOPOLITICAL',
    affectedAssets: ['XAUUSD', 'USD', 'USOIL'],
    summary: 'Increased naval tensions near trade corridors trigger sovereign accumulation in Gold bullion and crude oil hedges.',
  },
  {
    id: 'news-3',
    title: 'ECB Officials Open Door to Monetary Easing Amid Sluggish Manufacturing PMI',
    source: 'Financial Times',
    publishedAt: new Date(Date.now() - 52 * 60 * 1000).toISOString(),
    sentimentScore: -0.40,
    urgency: 'ROUTINE',
    catalystType: 'CENTRAL_BANK',
    affectedAssets: ['EURUSD', 'EUR'],
    summary: 'European Central Bank governors highlight contraction in German factory orders, weighing on Euro sentiment.',
  },
  {
    id: 'news-4',
    title: 'Bank of Japan Monitors Yen Volatility; Policy Normalization Speculation Grows',
    source: 'Nikkei Asian Review',
    publishedAt: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    sentimentScore: 0.50,
    urgency: 'BREAKING',
    catalystType: 'CENTRAL_BANK',
    affectedAssets: ['USDJPY', 'JPY'],
    summary: 'BOJ officials drop hints of further yield curve adjustments if wage growth accelerates, providing Yen support.',
  },
  {
    id: 'news-5',
    title: 'US Treasury 10-Year Yield Stabilizes Near Key Resistance as Bond Auctions Clear Cleanly',
    source: 'Dow Jones Wires',
    publishedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    sentimentScore: 0.15,
    urgency: 'ROUTINE',
    catalystType: 'MACRO_DATA',
    affectedAssets: ['USD', 'XAUUSD', 'SPX'],
    summary: 'Strong foreign demand at the 10-year note reopening calms rate volatility across multi-asset trading desks.',
  },
];

class NewsSentimentEngine {
  private newsItems: NewsSentimentItem[] = [...INITIAL_HEADLINES];
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Periodically update published timestamps or simulate fresh headline alerts
    if (typeof window !== 'undefined') {
      window.setInterval(() => {
        this.notify();
      }, 60_000);
    }
  }

  public getNews(): NewsSentimentItem[] {
    return [...this.newsItems];
  }

  public addHeadline(headline: Omit<NewsSentimentItem, 'id' | 'publishedAt'>): NewsSentimentItem {
    const item: NewsSentimentItem = {
      ...headline,
      id: `news-${Date.now()}`,
      publishedAt: new Date().toISOString(),
    };
    this.newsItems.unshift(item);
    if (this.newsItems.length > 20) {
      this.newsItems.pop();
    }
    this.notify();
    return item;
  }

  /**
   * Fast NLP sentiment scoring for any custom headline text.
   */
  public scoreHeadline(title: string): { score: number; catalyst: NewsSentimentItem['catalystType'] } {
    const lower = title.toLowerCase();
    let score = 0;

    // Bullish keywords
    const bullishWords = ['surge', 'jump', 'beat', 'growth', 'climb', 'hawkish', 'inflows', 'soar', 'rally', 'escalat', 'strong', 'higher'];
    // Bearish keywords
    const bearishWords = ['drop', 'slump', 'miss', 'fall', 'dovish', 'cut', 'recession', 'sluggish', 'weak', 'plunge', 'slowdown', 'lower'];

    for (const w of bullishWords) {
      if (lower.includes(w)) score += 0.25;
    }
    for (const w of bearishWords) {
      if (lower.includes(w)) score -= 0.25;
    }

    let catalyst: NewsSentimentItem['catalystType'] = 'MARKET_FLOW';
    if (lower.includes('fed') || lower.includes('ecb') || lower.includes('rate') || lower.includes('central bank') || lower.includes('powell')) {
      catalyst = 'CENTRAL_BANK';
    } else if (lower.includes('war') || lower.includes('conflict') || lower.includes('tension') || lower.includes('tariff') || lower.includes('sanction')) {
      catalyst = 'GEOPOLITICAL';
    } else if (lower.includes('cpi') || lower.includes('nfp') || lower.includes('gdp') || lower.includes('inflation') || lower.includes('pmi')) {
      catalyst = 'MACRO_DATA';
    } else if (lower.includes('earnings') || lower.includes('revenue') || lower.includes('guidance')) {
      catalyst = 'EARNINGS';
    }

    return {
      score: Math.max(-1.0, Math.min(1.0, score)),
      catalyst,
    };
  }

  /**
   * Optional Gemini API deep analysis for complex headlines.
   */
  public async analyzeWithGemini(headline: string): Promise<{ score: number; summary: string; bias: string }> {
    try {
      const runtimeEnv = typeof process !== 'undefined' ? process.env : undefined;
      const apiKey =
        import.meta.env.VITE_GEMINI_API_KEY ||
        runtimeEnv?.VITE_GEMINI_API_KEY ||
        runtimeEnv?.GEMINI_API_KEY ||
        undefined;

      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        const fallback = this.scoreHeadline(headline);
        return {
          score: fallback.score,
          summary: `Rule-based evaluation: ${fallback.catalyst} catalyst with sentiment score ${fallback.score}.`,
          bias: fallback.score > 0 ? 'BULLISH' : fallback.score < 0 ? 'BEARISH' : 'NEUTRAL',
        };
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a quantitative macro sentiment analyst. Analyze this financial headline:
"${headline}"

Respond with a JSON object:
{
  "sentimentScore": <number between -1.0 (very bearish) and +1.0 (very bullish)>,
  "bias": "<BULLISH | BEARISH | NEUTRAL>",
  "summary": "<1-sentence institutional market impact breakdown>"
}`;

      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      const text = res.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          score: Number(parsed.sentimentScore) || 0,
          summary: parsed.summary || 'Sentiment classified by Gemini.',
          bias: parsed.bias || 'NEUTRAL',
        };
      }
    } catch {
      // fallback
    }

    const fallback = this.scoreHeadline(headline);
    return {
      score: fallback.score,
      summary: `Automated sentiment analysis determined ${fallback.catalyst} catalyst.`,
      bias: fallback.score > 0 ? 'BULLISH' : fallback.score < 0 ? 'BEARISH' : 'NEUTRAL',
    };
  }

  /**
   * Evaluates overall news sentiment for a specific pair.
   */
  public evaluatePairSentiment(symbol: SupportedSymbol): {
    sentimentScore: number;
    sentimentBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    keyCatalyst?: string;
  } {
    let score = 0;
    let count = 0;
    let keyCatalyst: string | undefined = undefined;

    const sym = symbol.toUpperCase();
    for (const item of this.newsItems) {
      const isRelevant =
        item.affectedAssets.includes(sym) ||
        (sym === 'XAUUSD' && (item.affectedAssets.includes('XAUUSD') || item.affectedAssets.includes('USD') || item.catalystType === 'GEOPOLITICAL')) ||
        (sym.includes('USD') && item.affectedAssets.includes('USD')) ||
        (sym.includes('EUR') && item.affectedAssets.includes('EUR')) ||
        (sym.includes('GBP') && item.affectedAssets.includes('GBP')) ||
        (sym.includes('JPY') && item.affectedAssets.includes('JPY'));

      if (isRelevant) {
        let weight = item.sentimentScore;
        // If USD is bullish, it is bearish for EURUSD, GBPUSD, XAUUSD
        if (item.affectedAssets.includes('USD') && !item.affectedAssets.includes(sym)) {
          if (sym === 'EURUSD' || sym === 'GBPUSD' || sym === 'XAUUSD') {
            weight = -weight;
          }
        }
        // Geopolitical tension is strongly bullish for Gold (XAUUSD)
        if (sym === 'XAUUSD' && item.catalystType === 'GEOPOLITICAL') {
          weight = Math.abs(weight);
        }

        score += weight;
        count++;
        if (!keyCatalyst && (item.urgency === 'FLASH' || item.urgency === 'BREAKING')) {
          keyCatalyst = item.title;
        }
      }
    }

    const avgScore = count > 0 ? score / count : 0;
    const sentimentBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
      avgScore >= 0.20 ? 'BULLISH' : avgScore <= -0.20 ? 'BEARISH' : 'NEUTRAL';

    return {
      sentimentScore: Number(avgScore.toFixed(2)),
      sentimentBias,
      keyCatalyst: keyCatalyst || this.newsItems[0]?.title,
    };
  }

  /**
   * Calculates the global institutional sentiment index (-100 to +100).
   */
  public getGlobalSentimentIndex(): {
    score: number;
    label: 'EXTREME_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'EXTREME_BULLISH';
  } {
    if (this.newsItems.length === 0) return { score: 0, label: 'NEUTRAL' };
    const total = this.newsItems.reduce((sum, item) => sum + item.sentimentScore, 0);
    const avg = total / this.newsItems.length;
    const scaled = Math.round(avg * 100);

    let label: 'EXTREME_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'EXTREME_BULLISH' = 'NEUTRAL';
    if (scaled >= 60) label = 'EXTREME_BULLISH';
    else if (scaled >= 20) label = 'BULLISH';
    else if (scaled <= -60) label = 'EXTREME_BEARISH';
    else if (scaled <= -20) label = 'BEARISH';

    return { score: scaled, label };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }
}

export const newsSentimentEngine = new NewsSentimentEngine();

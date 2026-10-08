import React, { useState } from 'react';
import { TerminalSnapshot } from '../types/smc';
import { Sparkles, RefreshCw } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface AiAnalystProps {
  snapshot: TerminalSnapshot;
}

export const AiAnalyst: React.FC<AiAnalystProps> = ({ snapshot }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateAnalysis = async () => {
    if (!snapshot.brokerMarketData) {
      setAnalysis('Analysis unavailable: connect MT5 and wait for verified broker candles before requesting a market brief.');
      return;
    }
    setIsLoading(true);

    const promptContext = `You are a Tier-1 institutional FX & Commodities market analyst specializing in Smart Money Concepts (SMC) and order flow for Gold (XAUUSD).
Analyze the current live market state:
- Current Bid Price: ${snapshot.bid.toFixed(2)}, Ask: ${snapshot.ask.toFixed(2)}, Spread: ${snapshot.spread} pts
- 24h Range: High ${snapshot.high24h.toFixed(2)} - Low ${snapshot.low24h.toFixed(2)} (Change: ${snapshot.change24h > 0 ? '+' : ''}${snapshot.change24h} / ${snapshot.change24hPct}%)
- H1 Market Structure Bias: ${snapshot.bias.toUpperCase()}
- Last BOS: ${snapshot.bos ? `${snapshot.bos.kind} at ${snapshot.bos.price} (${snapshot.bos.direction})` : 'None'}
- Last CHoCH: ${snapshot.choch ? `${snapshot.choch.price} (${snapshot.choch.direction})` : 'None'}
- HTF Dealing Range: Low ${snapshot.dealing_range?.low} to High ${snapshot.dealing_range?.high} (Equilibrium: ${snapshot.dealing_range?.equilibrium})
- Current Dealing Position: ${snapshot.price_pos !== null ? (snapshot.price_pos < 0.5 ? 'DISCOUNT (< EQ)' : 'PREMIUM (> EQ)') : 'Unknown'}
- Unmitigated Zones: ${snapshot.zones.map((z) => `${z.kind} ${z.bullish ? 'Demand' : 'Supply'} (${z.bottom}-${z.top}) with ${z.tests} tests`).join('; ')}
- Institutional Session: ${snapshot.session.activeSessionName} (Tradable: ${snapshot.session.tradable})
- Active Signal: ${snapshot.signal ? `${snapshot.signal.direction} with confluence score ${snapshot.signal.score} (SL: ${snapshot.signal.sl}, TP: ${snapshot.signal.tp})` : 'No active setup above 5.0 threshold'}

Provide an ultra-concise, institutional trading brief in 3 short bullet sections:
1. Institutional Order Flow & Liquidity
2. Dealing Range & Zone POI Context
3. Tactical Execution Plan
Be professional, analytical, and direct. Avoid conversational filler.`;

    try {
      const runtimeEnv = typeof process !== 'undefined' ? process.env : undefined;
      const apiKey =
        import.meta.env.VITE_GEMINI_API_KEY ||
        runtimeEnv?.VITE_GEMINI_API_KEY ||
        runtimeEnv?.GEMINI_API_KEY ||
        undefined;

      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        setAnalysis('Analysis unavailable: configure VITE_GEMINI_API_KEY to generate a brief from the verified MT5 snapshot.');
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptContext,
      });
      setAnalysis(response.text || 'The analysis service returned no content.');
    } catch (error) {
      setAnalysis(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown analysis service error.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-[#1e2a3d]">
        <div className="flex items-center gap-1.5 text-white font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-[#4f8ef7]" />
          <span>Institutional Order Flow Analyst</span>
        </div>
        <button
          onClick={generateAnalysis}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[#1a2436] hover:bg-[#24334d] text-[#4f8ef7] text-[11px] font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{analysis ? 'Refresh' : 'Analyze Flow'}</span>
        </button>
      </div>

      {analysis ? (
        <div className="bg-[#0b0f17] border border-[#1e2a3d] rounded-lg p-3 text-[11px] text-[#dbe4f0] leading-relaxed whitespace-pre-line space-y-2">
          {analysis}
        </div>
      ) : (
        <div className="bg-[#0b0f17] border border-dashed border-[#1e2a3d] rounded-lg p-4 text-center space-y-2">
          <p className="text-[#6b7a90] text-[11px]">
            Synthesizes market structure, dealing ranges, unmitigated order blocks, and session liquidity into an institutional trading narrative.
          </p>
          <button
            onClick={generateAnalysis}
            className="px-3 py-1.5 rounded-lg bg-[#4f8ef7]/15 hover:bg-[#4f8ef7]/25 text-[#4f8ef7] border border-[#4f8ef7]/30 text-xs font-semibold transition-colors"
          >
            Generate SMC Order Flow Brief
          </button>
        </div>
      )}
    </div>
  );
};

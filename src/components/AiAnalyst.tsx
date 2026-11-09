import React, { useState } from 'react';
import { TerminalSnapshot } from '../types/smc';
import { Compass, RefreshCw, Layers, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface AiAnalystProps {
  snapshot: TerminalSnapshot;
}

export const AiAnalyst: React.FC<AiAnalystProps> = ({ snapshot }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateAnalysis = () => {
    if (!snapshot.brokerMarketData) {
      setAnalysis('Analysis unavailable: connect MT5 and wait for verified broker candles before generating an SMC order flow brief.');
      return;
    }
    setIsLoading(true);

    try {
      const positionStr = snapshot.price_pos !== null 
        ? (snapshot.price_pos < 0.5 
            ? `Discount Zone (${(snapshot.price_pos * 100).toFixed(1)}% of Dealing Range - Favors Longs)`
            : `Premium Zone (${(snapshot.price_pos * 100).toFixed(1)}% of Dealing Range - Favors Shorts)`)
        : 'Dealing Range Equilibrium';

      const biasText = snapshot.bias.toUpperCase();
      const unmitigatedSupply = snapshot.zones.filter((z) => !z.bullish && z.tests === 0);
      const unmitigatedDemand = snapshot.zones.filter((z) => z.bullish && z.tests === 0);

      const brief = `• 1. Institutional Order Flow & Market Structure:
H1 bias is ${biasText} with live Bid at ${snapshot.bid.toFixed(2)} and Ask at ${snapshot.ask.toFixed(2)} (Spread: ${snapshot.spread} pts).
${snapshot.bos ? `Latest Break of Structure (BOS): ${snapshot.bos.kind} at ${snapshot.bos.price.toFixed(2)} (${snapshot.bos.direction}).` : 'No recent H1 BOS.'}
${snapshot.choch ? `Change of Character (CHoCH): Detected at ${snapshot.choch.price.toFixed(2)} (${snapshot.choch.direction}) signaling structural shift.` : 'Structure remains intact without conflicting CHoCH.'}
24h Volatility Range: Low ${snapshot.low24h.toFixed(2)} to High ${snapshot.high24h.toFixed(2)} (Net Change: ${snapshot.change24h > 0 ? '+' : ''}${snapshot.change24h.toFixed(2)} / ${snapshot.change24hPct.toFixed(2)}%).

• 2. Dealing Range & Zone POI Context:
HTF Dealing Range: Low ${snapshot.dealing_range?.low.toFixed(2)} ⟷ High ${snapshot.dealing_range?.high.toFixed(2)} (Equilibrium 50%: ${snapshot.dealing_range?.equilibrium.toFixed(2)}).
Current Price Position: ${positionStr}.
Order Block Liquidity: ${unmitigatedDemand.length} unmitigated Demand POIs (${unmitigatedDemand.map((z) => `${z.bottom.toFixed(2)}-${z.top.toFixed(2)}`).slice(0, 2).join(', ') || 'None'}) | ${unmitigatedSupply.length} unmitigated Supply POIs (${unmitigatedSupply.map((z) => `${z.bottom.toFixed(2)}-${z.top.toFixed(2)}`).slice(0, 2).join(', ') || 'None'}).

• 3. Tactical Execution Plan & Session Liquidity:
Active Session: ${snapshot.session.activeSessionName} (Tradable: ${snapshot.session.tradable ? 'YES - Optimal Volatility Window' : 'NO - Low Liquidity / Off-Hours'}).
${snapshot.signal 
  ? `Active Setup: ${snapshot.signal.direction} Triggered | Confluence Score: ${snapshot.signal.score}/10 | SL: ${snapshot.signal.sl.toFixed(2)} | TP: ${snapshot.signal.tp.toFixed(2)} (R:R ${((Math.abs(snapshot.signal.tp - snapshot.bid) / Math.max(0.01, Math.abs(snapshot.bid - snapshot.signal.sl)))).toFixed(1)}:1).`
  : 'Tactical Stance: Monitoring for liquidity sweep into unmitigated POI prior to high-confluence entry trigger.'}`;

      setAnalysis(brief);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-[#1e2a3d]">
        <div className="flex items-center gap-1.5 text-white font-semibold">
          <Compass className="w-3.5 h-3.5 text-[#4f8ef7]" />
          <span>Institutional Order Flow Analyst</span>
        </div>
        <button
          onClick={generateAnalysis}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[#1a2436] hover:bg-[#24334d] text-[#4f8ef7] text-[11px] font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{analysis ? 'Refresh Brief' : 'Generate Brief'}</span>
        </button>
      </div>

      {analysis ? (
        <div className="bg-[#0b0f17] border border-[#1e2a3d] rounded-lg p-3 text-[11px] text-[#dbe4f0] leading-relaxed whitespace-pre-line space-y-2">
          {analysis}
        </div>
      ) : (
        <div className="bg-[#0b0f17] border border-dashed border-[#1e2a3d] rounded-lg p-4 text-center space-y-2">
          <p className="text-[#6b7a90] text-[11px]">
            Synthesizes market structure, dealing ranges, unmitigated order blocks, and session liquidity into a deterministic institutional order flow brief in real time.
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

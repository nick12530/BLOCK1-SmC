import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useEvents } from '../hooks/useTradingStore';

export const EventLogMini: React.FC = () => {
  const events = useEvents();
  const [copied, setCopied] = useState(false);
  const logs = (events.log || []).slice(0, 20);

  const handleCopy = () => {
    const text = logs
      .map((l) => `[${l.t || ''}] [${(l.type || 'info').toUpperCase()}] ${l.msg}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col bg-[#10141D] rounded border border-white/[0.06] overflow-hidden flex-1 min-h-[180px]">
      {/* Title Bar */}
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between bg-[#141923] shrink-0">
        <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-300">
          EVENT AUDIT LOG
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer flex items-center gap-1"
          title="Copy log to clipboard"
        >
          {copied ? <Check className="w-2.5 h-2.5 text-[#00E676]" /> : <Copy className="w-2.5 h-2.5" />}
          <span>{copied ? 'COPIED' : 'COPY'}</span>
        </button>
      </div>

      {/* Log Entries */}
      <div className="p-2 space-y-1 font-mono text-[10px] overflow-y-auto flex-1 max-h-[220px]">
        {logs.length === 0 ? (
          <div className="py-6 text-center text-zinc-600">
            Engine active. Waiting for system events.
          </div>
        ) : (
          logs.map((item, idx) => {
            const lType = item.type || 'info';
            const isTrade = lType === 'trade';
            const isSignal = lType === 'signal';
            const isWarn = lType === 'warn';
            const isError = lType === 'error';

            const chipColor = isError
              ? 'text-[#FF5252] bg-[#FF5252]/10'
              : isWarn
              ? 'text-amber-400 bg-amber-400/10'
              : isTrade
              ? 'text-[#00E676] bg-[#00E676]/10'
              : isSignal
              ? 'text-[#2979FF] bg-[#2979FF]/10'
              : 'text-zinc-400 bg-white/[0.04]';

            return (
              <div key={item.id || idx} className="flex items-start gap-1.5 leading-relaxed">
                <span className="text-zinc-600 tabular-nums shrink-0">{item.t || ''}</span>
                <span className={`px-1 py-0.2 rounded font-bold uppercase text-[9px] shrink-0 ${chipColor}`}>
                  {lType}
                </span>
                <span className="text-zinc-300 break-all">{item.msg}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { EngineLog } from '../types/smc';
import { Terminal, Shield, CheckCircle, AlertTriangle } from 'lucide-react';

interface EventLogProps {
  logs: EngineLog[];
}

export const EventLog: React.FC<EventLogProps> = ({ logs }) => {
  const [filter, setFilter] = useState<'all' | 'trade' | 'signal' | 'warn'>('all');

  const filteredLogs = logs.filter((l) => {
    if (filter === 'all') return true;
    if (filter === 'trade') return l.type === 'trade';
    if (filter === 'signal') return l.type === 'signal';
    if (filter === 'warn') return l.type === 'warn' || l.type === 'error';
    return true;
  });

  return (
    <div className="bg-[#121826] border border-[#1e2a3d] rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-[#1e2a3d]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6b7a90] flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[#4f8ef7]" />
          Terminal Event Stream
        </h3>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 text-[11px] font-mono">
          <button
            onClick={() => setFilter('all')}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              filter === 'all' ? 'bg-[#1a2436] text-white' : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('trade')}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              filter === 'trade'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            Trades
          </button>
          <button
            onClick={() => setFilter('signal')}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              filter === 'signal'
                ? 'bg-[#4f8ef7]/20 text-[#4f8ef7]'
                : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            Signals
          </button>
          <button
            onClick={() => setFilter('warn')}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              filter === 'warn'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-[#6b7a90] hover:text-[#94a3b8]'
            }`}
          >
            Alerts
          </button>
        </div>
      </div>

      <div className="bg-[#0b0f17] border border-[#1e2a3d] rounded-lg p-2.5 h-[170px] overflow-y-auto font-mono text-[11px] space-y-1">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((item) => {
            let textColor = 'text-[#94a3b8]';
            if (item.type === 'trade') textColor = 'text-emerald-400';
            else if (item.type === 'signal') textColor = 'text-[#4f8ef7] font-semibold';
            else if (item.type === 'warn') textColor = 'text-amber-400';
            else if (item.type === 'error') textColor = 'text-red-400';

            return (
              <div key={item.id} className="flex items-start gap-2 leading-tight">
                <span className="text-[#6b7a90] shrink-0 font-medium">[{item.t}]</span>
                <span className={`${textColor} break-all`}>{item.msg}</span>
              </div>
            );
          })
        ) : (
          <div className="text-center text-[#6b7a90] py-8">No events logged yet.</div>
        )}
      </div>
    </div>
  );
};

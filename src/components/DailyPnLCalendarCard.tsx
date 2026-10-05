import React, { useMemo, useState } from 'react';
import { usePositions } from '../hooks/useTradingStore';
import { useClosedTrades } from '../hooks/useTradingStore';
import { closedTradeDayKey, localDayKey } from '../engine/tradeJournal';
import { CalendarDays, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface DailyPnLCalendarCardProps {
  onOpenJournal: (date: string) => void;
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DailyPnLCalendarCard: React.FC<DailyPnLCalendarCardProps> = ({ onOpenJournal }) => {
  const closedTrades = useClosedTrades();
  const { positions } = usePositions();
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => localDayKey(today));
  const [isCalendarEnabled, setIsCalendarEnabled] = useState(false);

  const tradesByDate = useMemo(() => {
    const grouped = new Map<string, typeof closedTrades>();
    closedTrades.forEach((trade) => {
      const date = closedTradeDayKey(trade);
      if (!date) return;
      grouped.set(date, [...(grouped.get(date) || []), trade]);
    });
    return grouped;
  }, [closedTrades]);

  const selectedTrades = tradesByDate.get(selectedDate) || [];
  const selectedPnl = selectedTrades.reduce((total, trade) => total + trade.profit, 0);
  const todayPnl = (tradesByDate.get(localDayKey(today)) || []).reduce(
    (total, trade) => total + trade.profit,
    0
  );
  const monthDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const calendarCells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: monthDays }, (_, index) => index + 1),
  ];
  const floatingPnl = positions.reduce((total, position) => total + position.profit, 0);

  const moveMonth = (delta: number) => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(nextMonth);
    setSelectedDate(localDayKey(nextMonth));
  };

  return (
    <section
      aria-label="Daily profit and loss calendar"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-colors dark:border-[#1a3040] dark:bg-[#0d1823] sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-2 text-sky-600 dark:text-sky-400">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Daily P/L &amp; journal</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Realized results by local day · saved on this device
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right text-xs">
            <p className="text-slate-500 dark:text-zinc-400">Today realized</p>
            <strong className={todayPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {todayPnl >= 0 ? '+' : ''}${todayPnl.toFixed(2)}
            </strong>
          </div>
          <div className="text-right text-xs">
            <p className="text-slate-500 dark:text-zinc-400">Open P/L</p>
            <strong className={floatingPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {floatingPnl >= 0 ? '+' : ''}${floatingPnl.toFixed(2)}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setIsCalendarEnabled((enabled) => !enabled)}
            aria-pressed={isCalendarEnabled}
            aria-expanded={isCalendarEnabled}
            aria-controls="daily-pnl-calendar"
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors ${
              isCalendarEnabled
                ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950'
                : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            {isCalendarEnabled ? 'Hide calendar' : 'Show calendar'}
          </button>
        </div>
      </div>

      {isCalendarEnabled && (
        <div id="daily-pnl-calendar">
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          aria-label="Previous month"
          className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h3>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          aria-label="Next month"
          className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
        {weekdayLabels.map((weekday) => (
          <span key={weekday} className="py-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
            {weekday}
          </span>
        ))}
        {calendarCells.map((day, index) => {
          if (day === null) return <span key={`blank-${index}`} aria-hidden="true" />;
          const dateKey = localDayKey(new Date(month.getFullYear(), month.getMonth(), day));
          const trades = tradesByDate.get(dateKey) || [];
          const pnl = trades.reduce((total, trade) => total + trade.profit, 0);
          const isSelected = dateKey === selectedDate;
          const isToday = dateKey === localDayKey(today);
          return (
            <button
              type="button"
              key={dateKey}
              onClick={() => setSelectedDate(dateKey)}
              aria-pressed={isSelected}
              aria-label={`${dateKey}${trades.length ? `, ${trades.length} closed trades, ${pnl >= 0 ? 'profit' : 'loss'} ${Math.abs(pnl).toFixed(2)} dollars` : ', no closed trades'}`}
              className={`flex min-h-[4.25rem] flex-col items-center justify-center rounded-lg border px-1 py-1.5 transition-colors ${
                isSelected
                  ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
                  : isToday
                    ? 'border-sky-200 bg-white dark:border-sky-900 dark:bg-zinc-950'
                    : 'border-transparent bg-slate-50 hover:border-slate-200 dark:bg-zinc-900/70 dark:hover:border-zinc-700'
              }`}
            >
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">{day}</span>
              {trades.length > 0 ? (
                <>
                  <span className={`mt-0.5 text-[11px] font-bold tabular-nums ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-500">{trades.length} {trades.length === 1 ? 'trade' : 'trades'}</span>
                </>
              ) : (
                <span className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-600">—</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {selectedTrades.length} closed {selectedTrades.length === 1 ? 'trade' : 'trades'}
              {' · '}
              <span className={selectedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {selectedPnl >= 0 ? '+' : ''}${selectedPnl.toFixed(2)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenJournal(selectedDate)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-bold text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950"
          >
            <FileText className="h-4 w-4" />
            Review this day
          </button>
        </div>
        {selectedTrades.length > 0 && (
          <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-zinc-800">
            {selectedTrades.slice(0, 3).map((trade) => (
              <li key={`${trade.ticket}-${trade.closedAt || trade.closeTime}`} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700 dark:text-zinc-200">
                    {trade.type} · #{trade.ticket} · {trade.reason}
                  </span>
                  <span className={trade.profit >= 0 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-rose-600 dark:text-rose-400'}>
                    {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                  </span>
                </div>
                {trade.strategyRationale && (
                  <p className="mt-1 leading-relaxed text-slate-500 dark:text-zinc-400">
                    {trade.strategyRationale}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
        </div>
      )}
    </section>
  );
};

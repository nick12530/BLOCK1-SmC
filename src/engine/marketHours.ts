/**
 * marketHours.ts - Real-Time Interbank Gold (XAUUSD) Market Schedule
 * Detects whether interbank markets are actively trading or closed for the weekend:
 * - Gold Closes: Friday 21:00 UTC (17:00 EST)
 * - Gold Re-opens: Sunday 22:00 UTC (18:00 EST / Sydney Pre-Open)
 * - Weekday Rollover: 21:00 - 22:00 UTC
 */

import { useState, useEffect } from 'react';

export interface GlobalSession {
  id: 'sydney' | 'tokyo' | 'london' | 'new_york';
  name: string;
  isOpen: boolean;
  hoursUtc: string;
  hoursEst: string;
  openUtcHour: number;
  closeUtcHour: number;
  timeUntilOpen: string;
}

export interface MarketScheduleStatus {
  isOpen: boolean;
  statusText: string;
  isWeekend: boolean;
  reopenTimeFormatted: string;
  sessionName: string;
  timeUntilOpenFormatted: string;
  nextOpenTimestampMs: number;
  secondsUntilOpen: number;
  liveCountdownText: string;
  nextMarketOpenName: string;
  nextMarketOpenCountdown: string;
  isOverlapActive: boolean;
  activeSessions: string[];
  sessions: GlobalSession[];
}

export function getGoldMarketSchedule(date: Date = new Date()): MarketScheduleStatus {
  const day = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();
  const totalMinutes = hour * 60 + minute;
  const pad = (n: number) => n.toString().padStart(2, '0');

  let isOpen = true;
  let isWeekend = false;
  let statusText = 'MARKET OPEN';

  // Weekend Detection
  if (day === 6) {
    // Saturday: All day closed
    isOpen = false;
    isWeekend = true;
    statusText = 'CLOSED (WEEKEND)';
  } else if (day === 5 && totalMinutes >= 21 * 60) {
    // Friday after 21:00 UTC
    isOpen = false;
    isWeekend = true;
    statusText = 'CLOSED (WEEKEND)';
  } else if (day === 0 && totalMinutes < 22 * 60) {
    // Sunday before 22:00 UTC
    isOpen = false;
    isWeekend = true;
    statusText = 'CLOSED (WEEKEND)';
  } else if (totalMinutes >= 21 * 60 && totalMinutes < 22 * 60) {
    // Weekday 1-hour settlement rollover
    isOpen = false;
    isWeekend = false;
    statusText = 'DAILY SETTLEMENT ROLLOVER';
  }

  // Calculate countdown to Sunday 22:00 UTC if closed on weekend, or 22:00 UTC if rollover
  let timeUntilOpenFormatted = 'Opens Sun 22:00 UTC';
  let liveCountdownText = 'Market Open';
  let nextOpenTimestampMs = date.getTime();
  let secondsUntilOpen = 0;
  let nextMarketOpenName = 'Sydney Open';
  let nextMarketOpenCountdown = '00:00:00';

  if (!isOpen) {
    const target = new Date(date);
    if (day === 5) {
      target.setUTCDate(date.getUTCDate() + 2);
    } else if (day === 6) {
      target.setUTCDate(date.getUTCDate() + 1);
    } else if (day === 0) {
      // Sunday before 22:00 UTC
      target.setUTCDate(date.getUTCDate());
    }
    // Reopens at 22:00:00 UTC (18:00 EST / Sydney Pre-Open)
    target.setUTCHours(22, 0, 0, 0);
    nextOpenTimestampMs = target.getTime();

    const diffMs = target.getTime() - date.getTime();
    if (diffMs > 0) {
      secondsUntilOpen = Math.floor(diffMs / 1000);
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      liveCountdownText = `${diffHours}h ${pad(diffMinutes)}m ${pad(diffSeconds)}s`;
      timeUntilOpenFormatted = `${diffHours}h ${diffMinutes}m ${pad(diffSeconds)}s until Open`;
      nextMarketOpenName = isWeekend ? 'Sunday Interbank Open' : 'Rollover Reopen';
      nextMarketOpenCountdown = `${diffHours}h ${pad(diffMinutes)}m ${pad(diffSeconds)}s`;
    }
  } else {
    // When market is OPEN, find the next major upcoming session open
    // Sydney: 21:00 UTC, Tokyo: 00:00 UTC, London: 07:00 UTC, New York: 12:00 UTC
    let targetHour = 7;
    let nextName = 'London Open';

    if (hour >= 22 || hour < 0) {
      targetHour = 0;
      nextName = 'Tokyo Open';
    } else if (hour < 7) {
      targetHour = 7;
      nextName = 'London Open';
    } else if (hour < 12) {
      targetHour = 12;
      nextName = 'New York Open';
    } else if (hour < 21) {
      targetHour = 21;
      nextName = day === 5 ? 'Weekend Close' : 'Sydney Open';
    } else {
      targetHour = 22;
      nextName = 'Rollover Reopen';
    }

    const sessionTarget = new Date(date);
    if (targetHour === 0 && hour >= 22) {
      sessionTarget.setUTCDate(date.getUTCDate() + 1);
    }
    sessionTarget.setUTCHours(targetHour, 0, 0, 0);
    const diffMs = sessionTarget.getTime() - date.getTime();
    if (diffMs > 0) {
      secondsUntilOpen = Math.floor(diffMs / 1000);
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffMs % (1000 * 60)) / 1000);
      liveCountdownText = `${nextName} in ${h}h ${pad(m)}m ${pad(s)}s`;
      nextMarketOpenName = nextName;
      nextMarketOpenCountdown = `${pad(h)}:${pad(m)}:${pad(s)}`;
      timeUntilOpenFormatted = `${h}h ${pad(m)}m ${pad(s)}s until ${nextName}`;
    }
  }

  // Session detection & matrix
  const isSydneyOpen = isOpen && (hour >= 21 || hour < 6);
  const isTokyoOpen = isOpen && (hour >= 0 && hour < 9);
  const isLondonOpen = isOpen && (hour >= 7 && hour < 16);
  const isNewYorkOpen = isOpen && (hour >= 12 && hour < 21);
  const isOverlapActive = isOpen && (hour >= 12 && hour < 16);

  const activeSessions: string[] = [];
  if (isSydneyOpen) activeSessions.push('Sydney');
  if (isTokyoOpen) activeSessions.push('Tokyo');
  if (isLondonOpen) activeSessions.push('London');
  if (isNewYorkOpen) activeSessions.push('New York');

  let sessionName = 'Asian Session';
  if (isOverlapActive) {
    sessionName = 'London / New York Overlap (High Volatility)';
  } else if (isNewYorkOpen) {
    sessionName = 'New York Session';
  } else if (isLondonOpen) {
    sessionName = 'London Session';
  } else if (isTokyoOpen) {
    sessionName = 'Tokyo / Asian Session';
  } else if (isSydneyOpen) {
    sessionName = 'Sydney Session';
  }

  // Helper to format countdown to a specific UTC hour
  const getCountdownToHour = (targetH: number) => {
    const t = new Date(date);
    if (hour >= targetH) {
      t.setUTCDate(t.getUTCDate() + 1);
    }
    t.setUTCHours(targetH, 0, 0, 0);
    const ms = t.getTime() - date.getTime();
    if (ms <= 0) return '00:00:00';
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((ms % (1000 * 60)) / 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const sessions: GlobalSession[] = [
    {
      id: 'sydney',
      name: 'Sydney',
      isOpen: isSydneyOpen,
      hoursUtc: '21:00 - 06:00 UTC',
      hoursEst: '17:00 - 02:00 EST',
      openUtcHour: 21,
      closeUtcHour: 6,
      timeUntilOpen: isSydneyOpen ? 'ACTIVE' : getCountdownToHour(21),
    },
    {
      id: 'tokyo',
      name: 'Tokyo',
      isOpen: isTokyoOpen,
      hoursUtc: '00:00 - 09:00 UTC',
      hoursEst: '20:00 - 05:00 EST',
      openUtcHour: 0,
      closeUtcHour: 9,
      timeUntilOpen: isTokyoOpen ? 'ACTIVE' : getCountdownToHour(0),
    },
    {
      id: 'london',
      name: 'London',
      isOpen: isLondonOpen,
      hoursUtc: '07:00 - 16:00 UTC',
      hoursEst: '03:00 - 12:00 EST',
      openUtcHour: 7,
      closeUtcHour: 16,
      timeUntilOpen: isLondonOpen ? 'ACTIVE' : getCountdownToHour(7),
    },
    {
      id: 'new_york',
      name: 'New York',
      isOpen: isNewYorkOpen,
      hoursUtc: '12:00 - 21:00 UTC',
      hoursEst: '08:00 - 17:00 EST',
      openUtcHour: 12,
      closeUtcHour: 21,
      timeUntilOpen: isNewYorkOpen ? 'ACTIVE' : getCountdownToHour(12),
    },
  ];

  return {
    isOpen,
    statusText,
    isWeekend,
    reopenTimeFormatted: 'Sunday 18:00 EST / 22:00 UTC (01:00 EAT)',
    sessionName,
    timeUntilOpenFormatted,
    nextOpenTimestampMs,
    secondsUntilOpen,
    liveCountdownText,
    nextMarketOpenName,
    nextMarketOpenCountdown,
    isOverlapActive,
    activeSessions,
    sessions,
  };
}

export function useMarketOpenCountdown(): MarketScheduleStatus {
  const [schedule, setSchedule] = useState(() => getGoldMarketSchedule(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setSchedule(getGoldMarketSchedule(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return schedule;
}

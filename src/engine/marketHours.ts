/**
 * marketHours.ts - Real-Time Interbank Gold (XAUUSD) Market Schedule
 * Detects whether interbank markets are actively trading or closed for the weekend:
 * - Gold Closes: Friday 21:00 UTC (17:00 EST)
 * - Gold Re-opens: Sunday 22:00 UTC (18:00 EST / Sydney Pre-Open)
 * - Weekday Rollover: 21:00 - 22:00 UTC
 */

export interface MarketScheduleStatus {
  isOpen: boolean;
  statusText: string;
  isWeekend: boolean;
  reopenTimeFormatted: string;
  sessionName: string;
  timeUntilOpenFormatted: string;
}

export function getGoldMarketSchedule(date: Date = new Date()): MarketScheduleStatus {
  const day = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const totalMinutes = hour * 60 + minute;

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

  // Calculate countdown to Sunday 22:00 UTC if closed on weekend
  let timeUntilOpenFormatted = 'Opens Sun 22:00 UTC';
  if (!isOpen) {
    let target = new Date(date);
    if (day === 5) {
      target.setUTCDate(date.getUTCDate() + 2);
    } else if (day === 6) {
      target.setUTCDate(date.getUTCDate() + 1);
    }
    target.setUTCHours(22, 0, 0, 0);
    const diffMs = target.getTime() - date.getTime();
    if (diffMs > 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      timeUntilOpenFormatted = `${diffHours}h ${diffMinutes}m until Open`;
    }
  }

  // Session detection
  let sessionName = 'Asian Session';
  if (hour >= 7 && hour < 16) {
    sessionName = 'London Session';
  } else if (hour >= 12 && hour < 21) {
    sessionName = 'New York Session';
  }

  return {
    isOpen,
    statusText,
    isWeekend,
    reopenTimeFormatted: 'Sunday 17:00 EST / 22:00 UTC',
    sessionName,
    timeUntilOpenFormatted,
  };
}

/**
 * OfficialTradingViewEmbed.tsx - Institutional Real-Time TradingView Advanced Chart
 * Embeds official TradingView charting library widget directly with full indicator
 * suite, official drawing tools, timeframe switcher, and live market quotes.
 */

import React, { useEffect, useRef, memo } from 'react';

interface OfficialTradingViewEmbedProps {
  symbol: string;
  isDark?: boolean;
  interval?: '1' | '5' | '15' | '60' | '240' | 'D';
  height?: number | string;
}

export const OfficialTradingViewEmbed: React.FC<OfficialTradingViewEmbedProps> = memo(({
  symbol = 'OANDA:XAUUSD',
  isDark = true,
  interval = '1',
  height = '100%',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = '';

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'tradingview-widget-container';
    widgetWrapper.style.height = '100%';
    widgetWrapper.style.width = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    widgetWrapper.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    // Normalize symbol for TradingView
    let formattedSymbol = symbol;
    if (!formattedSymbol.includes(':')) {
      if (formattedSymbol.toUpperCase() === 'XAUUSD') formattedSymbol = 'OANDA:XAUUSD';
      else formattedSymbol = `FX:${formattedSymbol.toUpperCase()}`;
    }

    const widgetConfig = {
      autosize: true,
      symbol: formattedSymbol,
      interval: interval,
      timezone: 'Africa/Nairobi',
      theme: isDark ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      backgroundColor: isDark ? '#080d14' : '#ffffff',
      gridColor: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(226, 232, 240, 0.8)',
      support_host: 'https://www.tradingview.com',
    };

    script.innerHTML = JSON.stringify(widgetConfig);
    widgetWrapper.appendChild(script);
    container.appendChild(widgetWrapper);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [symbol, isDark, interval]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[380px] relative overflow-hidden bg-[#080d14]"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    />
  );
});

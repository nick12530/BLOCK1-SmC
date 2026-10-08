# SMC Trading Dashboard

A React/TypeScript dashboard for market-structure analysis, broker-aware risk sizing, trade monitoring, and an optional local MetaTrader 5 (MT5) bridge.

> **Trading risk:** This software is not financial advice and has not been certified for live trading. Broker execution, data, symbol specifications, network availability, and slippage can differ from the dashboard. Validate on an MT5 demo account first. Use a live account only if you independently understand and accept the risks.

## What it does

- Analyzes market structure, liquidity sweeps, fair-value gaps, order blocks, ATR, and technical setups.
- Shows multi-instrument opportunities for XAUUSD, EURUSD, USDJPY, and GBPUSD.
- Uses the connected broker's tick value, tick size, and volume limits to size orders within the configured risk cap. If the broker minimum lot would exceed that cap, the order is rejected rather than upsized.
- Synchronizes account details, positions, quotes, and closed-trade history from the connected MT5 terminal.
- Displays official TradingView charts as an independent chart view. TradingView's embedded widget does not expose OHLC candles to this app, so SMC indicators and broker orders require verified MT5 candle history.
- Supports manually confirmed broker orders and optional auto-trading. Auto-trading is off by default and requires a reachable, verified MT5 connection.
- Provides a private phone connection through Tailscale Serve; the MT5 terminal and bridge remain on the Windows PC.

When verified MT5 data is unavailable, quotes and candles are shown as unavailable, scanner setups are blocked, and order execution is disabled. The runtime does not substitute generated prices, replay scenarios, or tokenized-gold (PAXG) data for the selected broker instrument. TradingView remains a view-only chart and does not feed the indicator or execution engine.

## Run the dashboard

Requirements:

- Node.js 22
- Windows PC with MetaTrader 5 Desktop for broker execution
- Python and the packages in [`mt5-bridge/requirements.txt`](./mt5-bridge/requirements.txt) for the local bridge
- Tailscale on the PC and any phone used to access the private dashboard

Install JavaScript dependencies and start the development dashboard:

```powershell
npm install
npm run dev
```

For local broker/phone setup, log in to the intended MT5 account and run the private-link launcher from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\mt5-bridge\start_phone_link.ps1
```

The launcher builds the dashboard, creates a temporary bridge token, starts the local MT5 bridge and dashboard, and publishes the dashboard only to the Tailscale network. Keep the launcher windows open. Open the private HTTPS address it prints on the phone while Tailscale is connected on both devices.

**Do not expose port 8000, enable Tailscale Funnel, or publish the MT5 bridge to the public internet.** The bridge can place and manage broker orders.

In the dashboard, connect to the exact broker symbol shown in MT5 Market Watch. Confirm the account number, server, account type, live quote, spread, and positions before trading. Account passwords remain in MT5 Desktop and must never be entered into the dashboard.

## Safety and synchronization

- Each manual order requires a separate review and confirmation before submission.
- Auto-trading starts off. Enabling it permits unattended broker order submission; verify the selected account and configured limits first.
- A kill switch blocks new entries and requests closure of open broker positions. Check MT5 itself to confirm every close was executed.
- The bridge validates account identity, signal freshness, stop levels, configured risk, broker volume steps, daily loss, trade frequency, and other limits. The broker remains authoritative.
- Each connected dashboard polls positions and quotes about every two seconds and history about every 30 seconds. Temporary bridge/network failures retry with backoff; a failed connection clears broker quotes/candles and blocks trading until fresh broker data is received again. Auto-trading is not re-armed automatically after a bridge interruption.
- Shared account and control state comes from the MT5 bridge. Theme and sound preferences are local to each browser/device.
- Audio playback may require an initial user gesture and can be muted by browser/device settings.

## Development checks

```powershell
npm run lint
npm test
npm run build
```

The Python bridge is Windows/MT5-specific. Keep broker credentials and bridge tokens out of source control and logs.

See the [User Manual](./USER_MANUAL.md) for connection steps, order workflow, position-sizing warnings, phone setup, and troubleshooting.

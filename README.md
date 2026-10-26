# Institutional Smart Money Concepts (SMC) Trading System & MT5 Bridge

An algorithmic Smart Money Concepts (SMC) workstation for **Gold (XAUUSD)** and major Forex pairs (**EURUSD**, **GBPUSD**, **USDJPY**). Signal analysis and order execution require current, verified MetaTrader 5 (MT5) broker data. The TradingView chart is a separate view-only embed.

---

## 🌟 Key Features

### 1. 📊 Broker-Verified Signal Engine
- **MT5-Only Signal Inputs**: Quotes, candles, and symbol specifications come from the connected local MT5 bridge. Without fresh broker data, the dashboard waits and does not create prices or signals.
- **Technical Confluence**: Order Blocks, Fair Value Gaps, BOS/CHoCH structure, and related indicators are calculated from received broker candles. The multi-pair score is capped by a 100-point component budget, discounts stale structure breaks, and only credits nearby POIs. Candle-pattern geometry is pip-scaled per instrument; its heuristic score is not a probability or guarantee of return. Conflicting H1/M15 directional regimes wait for alignment.
- **SMC Indicator Overlay (ON / OFF)**: Seamlessly toggle all SMC technical layers directly over the chart with a single click. When OFF, enjoy naked candlestick price action; when ON, inspect institutional POIs, mitigation status, and Dealing Range equilibrium.
- **Granular Layer Controls**: Selectively enable or disable Order Blocks, Fair Value Gaps, Structure Breaks, Signal Targets, and Live Active Broker Trades.

### 2. ⚡ Direct MetaTrader 5 (MT5) Bridge & Broker Synchronization
- **Bidirectional Live Execution**: Trades taken inside the terminal reflect instantaneously on your connected MT5 terminal (demo or live accounts).
- **PC-Local Broker Telemetry**: Balance, equity, margin level, and floating P&L synchronize through a bridge bound to the same Windows PC.
- **Strategy Rationale Logging**: Every order sent to MT5 attaches institutional order block rationales and client tracking tags directly into MT5 order comments.
- **One-Click Break-Even Lock**: Lock profit on any running trade by shifting the stop loss to Entry + spread directly from the terminal.

### 3. 🛡️ Risk Controls & Broker Preflight
- **Risk-Budget Sizing**: Volume is rounded down to the broker step; if minimum lot risk exceeds the configured per-trade budget, the order is rejected.
- **Portfolio Stop-Risk Cap**: The MT5 bridge sums estimated downside at current stops across open positions and pending broker orders, then limits new exposure to the configured portfolio cap (3% of equity by default).
- **Fail-Closed Exposure Checks**: Missing stops or symbol risk specifications make total exposure unknown and block new orders; the bridge never bypasses these checks for a manual override.
- **Pre-Order Validation**: The bridge checks the refreshed quote, recalculates risk, and uses MT5 `order_check` before sending each order request.
- **Daily Loss Circuit Breaker & Kill Switch**: Independent controls block new trading when configured loss limits are reached and provide an emergency close action.

### 4. 🔊 Distinct Procedural Audio Synthesizer
- Procedural Web Audio API sound generator with zero external audio assets:
  - **Signals**: Soft harmonic crystal bell (Buy: uplifting E5→B5 chime; Sell: grounding D5→A4 chime).
  - **Precision Entries**: Separate three-note alert for strict, near-entry A+ setups.
  - **Trade Execution**: Mechanical order fill click + rising confirmation blip.
  - **Profits**: Triumphant ascending 4-note major arpeggio (C5 → E5 → G5 → C6).
  - **Losses**: Subdued descending warning tone (D4 → A3).

### 5. 🖥️ PC-Only Workspace
- **Local-Only Dashboard and Bridge**: The dashboard and MT5 bridge bind to loopback addresses on the Windows PC; remote bridge access is disabled.
- **Precision Entry Alerts**: Telegram and the popup use a strict A+ near-OTE qualification tier with structural, POI, momentum, spread, risk, and expiry checks. A separate approaching-trigger alert is informational only and does not place an order.
- **More Regular Setup Candidates**: Regular closed-candle signal scoring is modestly more permissive (4.5/10); multi-pair score gates are 65/100 (70 for GBPUSD). Fresh active-pair scanner candidates flow into the Signal Engine on a consistent 0-10 score scale; non-ready candidates remain visible with their block reason and cannot execute. Auto-execution still requires its separate 6/10 minimum plus risk, spread, news, expiry, and broker checks. If calendar data is unavailable, candidates remain visible but standard MT5 execution is held. Precision Entry alerts retain their strict A+ threshold.
- **Economic Calendar**: Upcoming USD, EUR, GBP, and JPY events are fetched server-side from the Forex Factory weekly calendar, with Finnhub used as an optional fallback when `FINNHUB_API_KEY` is configured. Missing or failed calendar data keeps standard scanner candidates blocked; a successfully fetched empty calendar is treated as no upcoming events.
- **Automatic Expiry**: Signal entry windows are tied to the source candle close and expired signals are removed from the feed and popup.
- **Distinct Sound Previews**: Signal, precision, trade, profit, and loss sounds can be auditioned separately from the safety bar.

### 6. 📈 Signal Quality & System Health
- **Feed Diagnostics**: The dashboard shows broker quote/candle freshness and scanner readiness/rejection reasons; stale or incomplete pair data is not replaced with sample values.
- **Closed-Trade Statistics**: Win rate, broker-reported net P&L, profit factor, and average outcome are calculated only from observed closed MT5 deal history for the selected time window.
- **Prospective Signal Validation**: A local journal follows READY signal triggers using subsequent closed broker M1 candles and records target-first, stop-first, ambiguous, and expired outcomes. It is a forward-observation sample, not an historical backtest; it does not model spread, commission, slippage, or executable fills.
- **Honest Metrics**: Confluence remains a technical score, never a probability or promise of profit.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **State Architecture**: Fine-grained subscription channels via `useSyncExternalStore` for microsecond render stability.
- **Charting**: Official TradingView Advanced Real-Time Chart widget + Institutional SMC SVG Engine with `SMCOverlayHUD`.
- **Market Data**: Local MT5 bridge for signal calculations and execution. TradingView chart embed is view-only; no TradingView, Binance, or ECB fallback quotes are used by the signal engine.
- **Audio Engine**: Native procedural Web Audio API with oscillators, biquad lowpass filters, and exponential gain ramping.
- **Broker Bridge**: Python 3 `MetaTrader5` socket bridge / REST bridge compatible with standard MT5 Windows installations.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 22+ and npm
- Python and MetaTrader 5 installed on the same Windows PC (for live broker execution)

### 1. Install & Run on the PC
```bash
# Clone the repository
git clone https://github.com/your-username/smc-trading-terminal.git
cd smc-trading-terminal

# Install dependencies
npm install

# Start the PC-only bridge and optimized dashboard
powershell -ExecutionPolicy Bypass -File .\mt5-bridge\start_pc.ps1
```
The launcher searches for available loopback ports, preferring 8000 for the bridge and 4173 for the dashboard, and selects another port when either is occupied. It prints and opens the selected dashboard URL. It requires installed dashboard dependencies and the MT5 Python bridge requirements; install them with `npm install` and `py -m pip install -r .\mt5-bridge\requirements.txt`.

The calendar works without an API key using the Forex Factory weekly feed. Optionally set a Finnhub API key in the current Windows user environment to enable it as a fallback; the browser never receives this secret:

```powershell
setx FINNHUB_API_KEY "<your Finnhub API key>"
```

After `setx` succeeds, close and reopen PowerShell, then run the launcher. The bridge refreshes the calendar every 15 minutes. If neither provider can be reached, scanner candidates remain blocked rather than assuming news risk is clear.

For local checks, use `npm run lint`, `npm test`, and `npm run build`. `npm run clean` is Windows-compatible and removes only the generated `dist` folder and `server.js` build output.

### 2. Connect MetaTrader 5 (Optional)
1. Open MT5 Desktop and sign in to the intended demo or live account.
2. Start the PC workspace using the launcher above.
3. In the dashboard, open **MT5**, verify the exact Market Watch symbol and account, then connect to the local bridge.
4. Confirm that the dashboard shows a live quote and the expected account state.

---

## 📈 Smart Money Concepts (SMC) Rules

| Concept | Description |
| :--- | :--- |
| **Demand OB (+OB)** | Bullish Order Block formed by the last down candle prior to an impulsive breakout. Valid buy zone. |
| **Supply OB (-OB)** | Bearish Order Block formed by the last up candle prior to an impulsive breakdown. Valid sell zone. |
| **BOS** | Break of Structure confirming trend continuation when a candle body closes beyond previous swing. |
| **CHoCH** | Change of Character indicating market structure shift and potential reversal. |
| **FVG** | Fair Value Gap representing a 3-bar liquidity imbalance acting as a price magnet. |
| **Dealing Range** | Calculated from swing high to swing low. Buys taken in Discount (<50% EQ); Sells taken in Premium (>50% EQ). |

---

## 🛡️ Configured Risk Limits

The current [risk-config.json](./risk-config.json) sets **1.25% risk per trade**, a **3% maximum portfolio stop-risk**, a **3% daily-loss circuit breaker**, and a **5-position maximum**. The bridge independently validates volume and cumulative open/pending risk. A position or pending order without a measurable stop is treated as unknown exposure and blocks additional entries. The broker's minimum lot is never forced above the configured risk budget.

The **Signal Quality & System Health** card reports live-feed freshness, per-pair readiness reasons, observed closed-trade results, and the local prospective signal-validation sample. Forward observations use later closed broker M1 bars; they are not an historical backtest and do not include execution costs or fill modeling.

---

## 📄 License

MIT License. Designed for institutional education and algorithmic trading workflows. Always exercise proper risk management in live financial markets.

# NIFTY Institutional SMC Trading Terminal & MT5 Bridge

An algorithmic Smart Money Concepts (SMC) workstation for **Gold (XAUUSD)** and major Forex pairs (**EURUSD**, **GBPUSD**, **USDJPY**). Signal analysis and order execution require current, verified MetaTrader 5 (MT5) broker data. The TradingView chart is a separate view-only embed.

---

## 🌟 Key Features

### 1. 📊 Broker-Verified Signal Engine
- **MT5-Only Signal Inputs**: Quotes, candles, and symbol specifications come directly from the connected local MT5 bridge. Without fresh broker data, the dashboard waits and does not create synthetic prices or signals.
- **Technical Confluence**: Order Blocks, Fair Value Gaps, BOS/CHoCH structure, and related indicators are calculated from verified broker candles.
- **SMC Indicator Overlay (ON / OFF)**: Toggle all SMC technical layers directly over the chart with a single click. When OFF, inspect naked candlestick price action; when ON, analyze institutional POIs, mitigation status, and Dealing Range equilibrium.
- **Granular Layer Controls**: Selectively enable or disable Order Blocks, Fair Value Gaps, Structure Breaks, Signal Targets, and Live Active Broker Trades.

### 2. ⚡ Direct MetaTrader 5 (MT5) Bridge & Broker Synchronization
- **Bidirectional Live Execution**: Trades executed in the terminal reflect instantaneously on your connected MT5 terminal (demo or live accounts).
- **PC-Local Broker Telemetry**: Balance, equity, margin level, and floating P&L synchronize through a high-speed Python bridge bound to `http://127.0.0.1:8000`.
- **Strategy Rationale Logging**: Every order sent to MT5 attaches institutional order block rationales and client tracking tags directly into MT5 order comments.
- **One-Click Break-Even Lock**: Lock profit on any running trade by shifting the stop loss to Entry + spread directly from the terminal.

### 3. 🌐 Real-Time Financial News & Macro Catalyst Feed
- **Live Institutional RSS/API Feeds**: The MT5 bridge parses real-time financial headlines directly from MarketWatch Top Stories and Dow Jones real-time wires with 60-second caching.
- **Deterministic High-Speed NLP Sentiment**: Real-time dictionary scoring categorizes breaking geopolitical shocks, central bank commentary, and economic surprises in under 1ms with zero LLM API rate limits, external costs, or hallucinations.
- **Direct Article Navigation**: Inspect source links directly from the news feed to read complete verified financial publications in your browser.

### 4. 🛡️ Risk Controls & Broker Preflight
- **Risk-Budget Sizing**: Volume is rounded down to the broker step; if minimum lot risk exceeds the configured per-trade budget, the order is rejected.
- **Portfolio Stop-Risk Cap**: The MT5 bridge sums estimated downside at current stops across open positions and pending broker orders, then limits new exposure to the configured portfolio cap (3% of equity by default).
- **Fail-Closed Exposure Checks**: Missing stops or symbol risk specifications make total exposure unknown and block new orders.
- **Pre-Order Validation**: The bridge checks refreshed quotes, recalculates risk, and uses MT5 `order_check` before sending order requests.
- **Daily Loss Circuit Breaker & Kill Switch**: Independent controls block new trading when configured loss limits are reached and provide an emergency close action.

### 5. 🔊 Distinct Procedural Audio Synthesizer
- Procedural Web Audio API sound generator with zero external audio assets:
  - **Signals**: Soft harmonic crystal bell (Buy: uplifting E5→B5 chime; Sell: grounding D5→A4 chime).
  - **Precision Entries**: Separate three-note alert for strict, near-entry A+ setups.
  - **Trade Execution**: Mechanical order fill click + rising confirmation blip.
  - **Profits**: Triumphant ascending 4-note major arpeggio (C5 → E5 → G5 → C6).
  - **Losses**: Subdued descending warning tone (D4 → A3).

### 6. 📈 Signal Quality & System Health
- **Feed Diagnostics**: The dashboard shows broker quote/candle freshness and scanner readiness/rejection reasons.
- **Closed-Trade Statistics**: Win rate, broker-reported net P&L, profit factor, and average outcome are calculated from observed closed MT5 deal history.
- **Prospective Signal Validation**: A local journal logs READY signal triggers using subsequent closed broker M1 candles.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons.
- **State Architecture**: Fine-grained subscription channels via `useSyncExternalStore` for microsecond render stability.
- **Charting**: Official TradingView Advanced Real-Time Chart widget + Institutional SMC SVG Engine with `SMCOverlayHUD`.
- **Market Data**: Local MT5 bridge for signal calculations and execution. TradingView chart embed is view-only.
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
git clone https://github.com/nick12530/FDO.git
cd FDO

# Install dependencies
npm install

# Start the PC-only bridge and dashboard
powershell -ExecutionPolicy Bypass -File .\mt5-bridge\start_pc.ps1
```

### 2. Connect MetaTrader 5
1. Open MT5 Desktop and sign in to your demo or live account.
2. Start the local bridge server via `start_pc.ps1` or `python mt5-bridge/server.py`.
3. In the terminal header, click **MT5 Bridge** to verify connectivity.
4. Confirm live quotes and telemetry appear in the terminal.

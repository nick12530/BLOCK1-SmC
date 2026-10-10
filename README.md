# Institutional Smart Money Concepts (SMC) Trading System & MT5 Bridge

An institutional-grade algorithmic Smart Money Concepts (SMC) workstation and real-time execution engine for **Gold (XAUUSD)** and major Forex pairs (**EURUSD**, **GBPUSD**, **USDJPY**). Built with high-precision order flow detection, live TradingView chart data streaming, togglable indicator overlays, and direct MetaTrader 5 (MT5) broker synchronization.

---

## 🌟 Key Features

### 1. 📊 Live TradingView Chart Data & Signal Engine
- **TradingView Real-Time Data**: Queries verified TradingView scanner endpoints (`OANDA:XAUUSD`, `FX:EURUSD`, `FX:GBPUSD`, `FX:USDJPY`) for live bid, ask, spread, high, low, and volume.
- **Data-Driven Signal Generation**: Algorithmic signals (Order Blocks, Fair Value Gaps, BOS/CHoCH structural breaks) are calculated directly from live TradingView chart data.
- **SMC Indicator Overlay (ON / OFF)**: Seamlessly toggle all SMC technical layers directly over the chart with a single click. When OFF, enjoy naked candlestick price action; when ON, inspect institutional POIs, mitigation status, and Dealing Range equilibrium.
- **Granular Layer Controls**: Selectively enable or disable Order Blocks, Fair Value Gaps, Structure Breaks, Signal Targets, and Live Active Broker Trades.

### 2. ⚡ Direct MetaTrader 5 (MT5) Bridge & Broker Synchronization
- **Bidirectional Live Execution**: Trades taken inside the terminal reflect instantaneously on your connected MT5 terminal (demo or live accounts).
- **Synced PC & Mobile Broker Telemetry**: Real-time balance, equity, margin level, and floating P&L stay synchronized across desktop and mobile screens.
- **Strategy Rationale Logging**: Every order sent to MT5 attaches institutional order block rationales and client tracking tags directly into MT5 order comments.
- **One-Click Break-Even Lock**: Lock profit on any running trade by shifting the stop loss to Entry + spread directly from the terminal.

### 3. 🛡️ Small Account Risk Protection ($10+ Accounts)
- **Account Sizing Protections**: Tailored risk rules for small accounts ($10–$100):
  - Strictly **1 open position** at a time for accounts under $100.
  - Daily trade limit: **5 trades per day** (max 3 per pair).
  - **High-Confluence Fallback Override**: High-scoring setups (Score ≥ 70) with top risk-to-reward ratios can bypass daily caps when the override is enabled.
- **Basket Protection & Kill Switch**: Emergency kill switch with instant position liquidation and basket drawdown protection (-12% drawdown cap / +15% profit target).

### 4. 🔊 Distinct Procedural Audio Synthesizer
- Procedural Web Audio API sound generator with zero external audio assets:
  - **Signals**: Soft harmonic crystal bell (Buy: uplifting E5→B5 chime; Sell: grounding D5→A4 chime).
  - **Trade Execution**: Mechanical order fill click + rising confirmation blip.
  - **Profits**: Triumphant ascending 4-note major arpeggio (C5 → E5 → G5 → C6).
  - **Losses**: Subdued descending warning tone (D4 → A3).

### 5. 📱 Mobile First & PWA Ready
- **Bolder System Typography & Large Mobile Text**: Enhanced font weights and larger touch targets for optimal visibility on mobile screens.
- **Active Positions Block Below Signals**: Trade monitor positioned directly beneath the signal engine card on mobile for immediate access to floating P&L and lot management.
- **Standalone PWA**: Installable as a native app on iOS Safari and Android Chrome with zero browser navigation bars.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **State Architecture**: Fine-grained subscription channels via `useSyncExternalStore` for microsecond render stability.
- **Charting**: Official TradingView Advanced Real-Time Chart widget + Institutional SMC SVG Engine with `SMCOverlayHUD`.
- **Market Data Feeds**: TradingView Scanner API, Binance Interbank Feeds, Frankfurter ECB Forex Rates.
- **Audio Engine**: Native procedural Web Audio API with oscillators, biquad lowpass filters, and exponential gain ramping.
- **Broker Bridge**: Python 3 `MetaTrader5` socket bridge / REST bridge compatible with standard MT5 Windows installations.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ and npm
- (Optional for live execution) MetaTrader 5 installed on Windows or a VPS with Python 3.9+

### 1. Install & Run Terminal
```bash
# Clone the repository
git clone https://github.com/your-username/smc-trading-terminal.git
cd smc-trading-terminal

# Install dependencies
npm install

# Start the local development server
npm run dev
```
Open your browser at `http://localhost:3000`.

### 2. Connect MetaTrader 5 (Optional)
To link your real or demo broker account:
1. Open the terminal and click **"Connect MT5"** in the top navigation bar.
2. Download or copy the provided `mt5_bridge.py` script.
3. In your Windows MT5 terminal:
   - Ensure **"Allow algorithmic trading"** is checked in Tools > Options > Expert Advisors.
   - Run the bridge script:
     ```bash
     python mt5_bridge.py
     ```
4. Enter your bridge address (`ws://localhost:8765` or HTTP port) and click **Connect**.
5. Your account balance, equity, and live trades will now mirror in real time!

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

## 🛡️ Small Account Protection Matrix

| Parameter | Under $100 Account | $100+ Account |
| :--- | :--- | :--- |
| **Max Open Positions** | 1 Position | Up to 10 Positions |
| **Daily Trade Cap** | 5 Trades (3 per pair) | Configurable |
| **Fallback Override** | Allowed on Score ≥ 70 | Active |
| **Max Daily Loss** | 5.0% | Configurable |
| **Risk Per Trade** | 1.0% | Configurable |

---

## 📄 License

MIT License. Designed for institutional education and algorithmic trading workflows. Always exercise proper risk management in live financial markets.

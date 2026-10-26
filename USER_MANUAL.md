# User Manual

## 1. Understand the operating modes

The dashboard does not generate sample prices or signals. Until a verified MT5 connection supplies fresh quotes, candles, and symbol specifications, the signal deck and chart display a waiting state.

When disconnected, orders are blocked; there is no local paper-trading mode. For market-based testing, use an MT5 demo account and verify the account type and server in MT5 before connecting. A connected live account sends broker orders; it is not paper mode.

Live account data and broker execution require all of the following:

1. MT5 Desktop is open and logged into the intended account.
2. The local MT5 bridge and dashboard are running on that PC.
3. The dashboard reports an active MT5 connection and current broker quote.
4. The exact symbol is available in the broker's Market Watch.

Use a demo account to verify the complete process before considering a live account. This application is not certified for live trading.

## 2. Connect MT5 on the Windows PC

1. Install Node.js 22 and Python, then install the project and MT5 bridge dependencies:

   ```powershell
   npm install
   py -m pip install -r .\mt5-bridge\requirements.txt
   ```

2. Open MT5 Desktop, sign in, and confirm the account and server shown in MT5.
3. The economic calendar uses the Forex Factory weekly feed by default. Optionally configure a Finnhub API key as a fallback in the Windows user environment:

   ```powershell
   setx FINNHUB_API_KEY "<your Finnhub API key>"
   ```

   Close and reopen PowerShell after running `setx`; the bridge reads the key from its process environment and does not send it to the dashboard.
4. From the repository folder, run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\mt5-bridge\start_pc.ps1
   ```

5. Keep both PowerShell windows open. The launcher builds and starts the PC-local bridge and optimized dashboard. It prefers ports 8000 (bridge) and 4173 (dashboard), but automatically chooses another available loopback port when either is occupied; use the dashboard URL printed by the launcher.
6. In the dashboard, open **MT5**, enter the exact symbol shown in Market Watch, choose the instrument type, and connect.
7. Confirm the account number, server, demo/live account type, quote, spread, risk settings, and open positions.

The dashboard does not ask for an MT5 password. The bridge listens only on the local PC; do not expose its selected port to other devices or the internet.

The **TradingView Official** chart displays TradingView's own market chart. Its embedded widget is view-only for this application: TradingView does not provide its candle OHLC data to the dashboard's indicator engine. To use the SMC overlays and broker order workflow, the app separately requires a complete, fresh MT5 candle feed.

To switch accounts, disconnect the dashboard, change the account in MT5 Desktop, then reconnect and verify the new account details.

## 3. Review signals and place a manual trade

1. Select the intended instrument and wait for MT5 candles and a current quote to synchronize.
2. Review the setup direction, timeframe, entry, stop-loss, take-profit, risk/reward, broker spread, and position size.
3. Choose the order action. A confirmation dialog shows the intended direction, approximate entry, volume, protective levels, and MT5 account.
4. Verify those details and explicitly confirm to submit the broker order.
5. Check the returned order/position and verify it in MT5 Desktop. Broker fills can be partial, delayed, rejected, or affected by slippage.
6. Position scale-out sends a partial-close request to MT5 and is limited by the broker's volume minimum and step. Verify the remaining position and stop in MT5 after the request.

Disconnected dashboard orders are not sent to a broker. Auto-trading also cannot be enabled without a verified, reachable MT5 account.

The compact signal deck is collapsed by default and displays tradeable setups first, with the ready count and OTE trigger for each pair. Fresh active-pair scanner candidates are also routed into the Signal Engine, with their confluence converted consistently to its 0-10 display scale. Non-ready candidates show their blocking reason and cannot be executed. Its confluence score is an analysis score out of 100, not a win probability. Scanner pattern geometry is scaled by the selected instrument's pip size; the pattern score is heuristic, not a measured probability. Conflicting H1/M15 directional regimes do not receive a trend-following bias, and zone/structure contributions require price proximity or recent aligned breaks. If no broker-valid lot fits the configured risk budget, the trade action stays blocked rather than forcing the broker minimum. Signal price distances and open-position movement are displayed using the selected instrument's pip size. Regular closed-candle signal scoring is modestly more permissive (4.5/10); multi-pair score thresholds are 65/100 (70 for GBPUSD). Auto-execution still requires at least 6/10 for 0-10 technical signals, or the configured confluence threshold for 0-100 scanner signals, plus spread, news, position-sizing, expiry, and broker checks. The server-side Forex Factory calendar, with optional Finnhub fallback, is refreshed every 15 minutes and checks upcoming high-impact USD, EUR, GBP, and JPY events. If both providers are unavailable, standard signal readiness remains blocked rather than assuming there is no event risk; the candidate and block reason remain visible, but standard MT5 execution is held. A successful calendar response with no events is valid. The separate **Precision Entry** popup and Telegram alert remain stricter: they require an A+ setup with strong structural, POI, and momentum confirmation, acceptable spread/risk gates, a fresh entry window, and price near the calculated OTE. The popup shows both the current quote and OTE trigger. Signals are probabilistic; no setup can guarantee a return. Check the live quote and risk before execution. Passed signals expire automatically.

### Signal quality, forward validation, and exposure

- **Signal Quality & System Health** shows broker quote age, M1 candle age, current spread, and each pair's current scanner status or reason it was excluded. A stale/incomplete feed is not treated as a valid signal.
- **Closed-trade results** are based on observed MT5 closed deal history. The period selector changes the observed sample window; an empty sample is shown as unavailable, not as 0% performance. Broker-reported deal P&L includes deal costs returned by MT5.
- **Prospective signal validation** records each unique READY trigger and follows later closed broker M1 candles through the setup's expiry. Outcomes distinguish target-first, stop-first, ambiguous same-candle outcomes, expiry before trigger, and triggered-but-unresolved expiry. Only resolved target/stop outcomes contribute to the displayed resolved rate. This is a forward-observation record, **not a historical backtest**; it does not model spread, commission, slippage, order execution, or fills. Records are held in this browser's local journal (up to 300 recent observations).
- **Entry approaching alerts** can be enabled in **External Alerts & Telegram Push → Filter Sensitivity & Rules**. They are distinct from the strict near-entry alert and mean the A+ setup is approaching its OTE trigger from the expected side; they do not mean an order has been placed. Check the current quote, confirmation, spread, and risk yourself.
- **Portfolio stop-risk** shows the estimate for open positions and pending broker orders relative to the configured cap. It is calculated from entry/trigger to current stop using the broker's tick size/value. Missing stops/specifications are shown as unknown and block a new order at the bridge.

Use the MT5 Strategy Tester with broker-appropriate tick data and execution costs, then validate on unseen/forward data before changing the signal rules or treating observed sample metrics as predictive. A historical or prospective win rate cannot guarantee future performance.

## 4. Understand “Safe position size unavailable”

The system calculates the maximum volume allowed by the configured risk percentage, stop distance, and broker's symbol specifications. It then rounds down to a valid broker volume step.

The warning means no valid broker lot size fits the configured risk for this stop. Common causes include:

- The broker's minimum lot would risk more than the configured risk budget.
- The account equity is small relative to the stop distance or instrument contract size.
- MT5 has not supplied valid tick-value, tick-size, or volume-limit data for the selected symbol.
- The requested volume is below the broker minimum, above its maximum, or incompatible with its volume increment.

For example, at 0.5% risk on a $100 account, the budget is $0.50. If the broker's minimum permitted lot would lose more than $0.50 at the stop, the trade is rejected. The current configuration uses 1.25% per trade to accommodate the broker's minimum volume on the current small account, but this increases potential losses. The software deliberately does not force a minimum lot; if the live stop risk exceeds the current budget, the trade remains blocked. Recheck the account, symbol, stop, and broker specifications before trading.

The current configuration is 1.25% risk per trade, a 3% portfolio stop-risk cap, a 3% daily-loss limit, and at most five open positions. On an equity of about $89.92, 1.25% is about $1.12 per trade; the earlier $0.94 minimum-lot estimate fits this budget, with about $0.18 headroom. This is a per-trade maximum, not a target: the bridge sizes down when possible and blocks the trade if its refreshed stop risk exceeds the budget. Before an order is sent, the bridge refreshes the quote, rechecks the volume against both per-trade and portfolio risk, and calls MT5 `order_check`. The portfolio calculation includes existing open positions and pending broker orders; risk-consuming overrides cannot bypass the minimum-lot or portfolio-risk checks. The 3% portfolio and daily-loss limits remain unchanged. Risk is estimated from current stops and is not a guarantee against gaps or slippage.

## 5. Auto-trading and kill switch

- Auto-trading is **off by default**.
- Enabling it authorizes the system to submit eligible orders without a separate confirmation for each one. Verify the selected MT5 account, instrument, broker feed, risk limits, and news/spread conditions before enabling.
- Turning auto-trade off on one connected dashboard updates the shared bridge state.
- The kill switch blocks new trades and sends close requests for open positions. A broker may reject or delay a close; confirm the resulting positions in MT5.
- If the bridge is offline, trading actions are paused. A displayed position snapshot may be stale until synchronization resumes.

## 6. Sound alerts

Signal, precision-entry, order, profit, and loss alerts use different sounds. Use **Test** in the safety bar to preview each sound. Allow audio after interacting with the page; browser autoplay policies can prevent sounds until the first gesture. The sound toggle and volume setting are stored in this PC browser.

## 7. Troubleshooting

| Symptom | What to check |
|---|---|
| MT5 connection fails | Ensure MT5 is open and logged in; keep launcher windows open; verify the exact broker symbol; inspect the bridge PowerShell window. |
| Account shown as offline | Check the PC, bridge process, and MT5 terminal. The bridge retries automatically; broker orders remain paused while offline. |
| No signals after changing symbols | Wait for the selected symbol's broker candles and quote to synchronize. Stale or unavailable broker data is not considered tradeable. |
| TradingView chart appears but SMC indicators are paused | TradingView is a separate view-only embed and cannot supply the app's indicator inputs. Restore MT5 candle history; do not treat TradingView's visible chart as verified MT5 execution data. |
| “Safe position size unavailable” | Read the dialog's broker-specific details. The minimum lot may exceed the configured risk budget; the system will not upsize risk to fit it. |
| “Risk unknown” or portfolio limit rejection | Check all MT5 open positions and pending orders for valid stop-loss levels, then verify broker tick-size/value data. The bridge blocks additional exposure if the aggregate cannot be calculated safely. |
| No prospective validation results | The sample starts collecting only while fresh MT5 broker data is connected and READY setups occur. It needs subsequent closed M1 candles; the first run will not have historical outcomes. |
| Order is pending, partial, or rejected | Check the order and positions in MT5, verify stops and volume limits, and review the dashboard event log. Do not assume a pending/partial order is fully filled. |
| No sound | Unmute the dashboard, check device/browser volume, and interact with the page once to enable browser audio. |

## 8. Risk notice

Trading can result in losses, including losses greater than expected because of gaps, slippage, spreads, leverage, broker execution, or technical/network failure. Risk limits and the kill switch cannot guarantee an outcome or replace broker-side monitoring. Independently verify all orders and account state in MT5.

# User Manual

## 1. Understand the operating modes

The dashboard can show generated/sample data before a broker is connected. That mode is for exploring the interface only: prices and opportunities are not live broker data, and no broker order should be inferred from them.

Live account data and broker execution require all of the following:

1. MT5 Desktop is open and logged into the intended account.
2. The local MT5 bridge and dashboard are running on that PC.
3. The dashboard reports an active MT5 connection and current broker quote.
4. The exact symbol is available in the broker's Market Watch.

Use a demo account to verify the complete process before considering a live account. This application is not certified for live trading.

## 2. Connect MT5 on the Windows PC

1. Install Node.js 22, Python, and Tailscale.
2. Open MT5 Desktop, sign in, and confirm the account and server shown in MT5.
3. From the repository folder, run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\mt5-bridge\start_phone_link.ps1
   ```

4. Keep the PowerShell windows open. The launcher starts the bridge and dashboard, and prints a private Tailscale HTTPS address.
5. In the dashboard, open **MT5**, enter the exact symbol shown in Market Watch, choose the instrument type, and connect.
6. Confirm the account number, server, demo/live account type, quote, spread, risk settings, and open positions.

The dashboard does not ask for an MT5 password. Do not expose port 8000, use Tailscale Funnel, or share the private dashboard address or bridge token publicly.

To switch accounts, disconnect the dashboard, change the account in MT5 Desktop, then reconnect and verify the new account details.

## 3. Connect from a phone

1. Install Tailscale on the phone and sign in to the same private network as the Windows PC.
2. Open the private HTTPS address printed by the launcher.
3. Open **MT5** in the dashboard and connect to the same account and symbol.
4. Keep Tailscale connected and the PC, MT5, launcher, bridge, and dashboard running.

The connected dashboard reads account details, quotes, positions, and closed trades from the shared bridge. Quotes/positions are refreshed about every two seconds and history about every 30 seconds. Reconnection is retried after temporary network interruptions; the dashboard pauses broker orders while its bridge connection is offline.

Each browser stores its own display and sound preferences. The bridge's trading controls are shared across connected dashboards, so changing auto-trade or the kill switch on one device affects the shared bridge state.

## 4. Review signals and place a manual trade

1. Select the intended instrument and wait for MT5 candles and a current quote to synchronize.
2. Review the setup direction, timeframe, entry, stop-loss, take-profit, risk/reward, broker spread, and position size.
3. Choose the order action. A confirmation dialog shows the intended direction, approximate entry, volume, protective levels, and MT5 account.
4. Verify those details and explicitly confirm to submit the broker order.
5. Check the returned order/position and verify it in MT5 Desktop. Broker fills can be partial, delayed, rejected, or affected by slippage.

Disconnected dashboard orders are not sent to a broker. Auto-trading also cannot be enabled without a verified, reachable MT5 account.

## 5. Understand “Safe position size unavailable”

The system calculates the maximum volume allowed by the configured risk percentage, stop distance, and broker's symbol specifications. It then rounds down to a valid broker volume step.

The warning means no valid broker lot size fits the configured risk for this stop. Common causes include:

- The broker's minimum lot would risk more than the configured risk budget.
- The account equity is small relative to the stop distance or instrument contract size.
- MT5 has not supplied valid tick-value, tick-size, or volume-limit data for the selected symbol.
- The requested volume is below the broker minimum, above its maximum, or incompatible with its volume increment.

For example, at 0.5% risk on a $100 account, the budget is $0.50. If the broker's minimum permitted lot would lose more than $0.50 at the stop, the trade is rejected. The software deliberately does not force a minimum lot. Do not bypass this control. Recheck the account, symbol, stop, and broker specifications; any change to account size or risk settings is your decision and can increase losses.

## 6. Auto-trading and kill switch

- Auto-trading is **off by default**.
- Enabling it authorizes the system to submit eligible orders without a separate confirmation for each one. Verify the selected MT5 account, instrument, broker feed, risk limits, and news/spread conditions before enabling.
- Turning auto-trade off on one connected dashboard updates the shared bridge state.
- The kill switch blocks new trades and sends close requests for open positions. A broker may reject or delay a close; confirm the resulting positions in MT5.
- If the bridge is offline, trading actions are paused. A displayed position snapshot may be stale until synchronization resumes.

## 7. Sound alerts and mobile visibility

Signal, order, profit, and loss alerts use different sounds. Allow audio after interacting with the page; browser autoplay policies can prevent sounds until the first gesture. The sound toggle and volume setting are stored separately on each device.

The mobile layout enlarges small text and uses stronger default text weight. Increase browser zoom or device text size further if needed.

## 8. Troubleshooting

| Symptom | What to check |
|---|---|
| MT5 connection fails | Ensure MT5 is open and logged in; keep launcher windows open; verify the exact broker symbol; inspect the bridge PowerShell window. |
| Phone cannot connect | Confirm Tailscale is connected on both devices and the private HTTPS address is current. Do not use a public URL or Funnel. |
| Account shown as offline | Check the PC, bridge process, MT5 terminal, and Tailscale. The bridge retries automatically; broker orders remain paused while offline. |
| No signals after changing symbols | Wait for the selected symbol's broker candles and quote to synchronize. Stale or unavailable broker data is not considered tradeable. |
| “Safe position size unavailable” | Read the dialog's broker-specific details. The minimum lot may exceed the configured risk budget; the system will not upsize risk to fit it. |
| Order is pending, partial, or rejected | Check the order and positions in MT5, verify stops and volume limits, and review the dashboard event log. Do not assume a pending/partial order is fully filled. |
| No sound | Unmute the dashboard, check device/browser volume, and interact with the page once to enable browser audio. |

## 9. Risk notice

Trading can result in losses, including losses greater than expected because of gaps, slippage, spreads, leverage, broker execution, or technical/network failure. Risk limits and the kill switch cannot guarantee an outcome or replace broker-side monitoring. Independently verify all orders and account state in MT5.

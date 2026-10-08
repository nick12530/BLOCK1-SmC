"""Local-only FastAPI bridge for a MetaTrader 5 terminal on Windows."""

from __future__ import annotations

import math
import os
import hmac
import json
import sqlite3
import threading
from functools import wraps
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, cast
from zoneinfo import ZoneInfo

import MetaTrader5 as mt5  # type: ignore[attr-defined]
mt5 = cast(Any, mt5)
from fastapi import FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, Field

app = FastAPI(title="Local MT5 Bridge", docs_url=None, redoc_url=None)
_order_id_lock = threading.Lock()
_trade_execution_lock = threading.Lock()
_inflight_order_requests: set[str] = set()
_symbol_spec_cache: dict[tuple[int, str, str], dict] = {}
RISK_CONFIG = json.loads((Path(__file__).resolve().parents[1] / "risk-config.json").read_text(encoding="utf-8"))
STATE_DIRECTORY = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "SMCBridge"
STATE_DIRECTORY.mkdir(parents=True, exist_ok=True)
STATE_DATABASE = STATE_DIRECTORY / "order-idempotency.sqlite3"


def initialize_state_database() -> None:
    with sqlite3.connect(STATE_DATABASE) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS order_requests (
                client_order_id TEXT PRIMARY KEY,
                account_login INTEGER NOT NULL,
                account_server TEXT NOT NULL,
                symbol TEXT NOT NULL,
                poi_key TEXT NOT NULL,
                direction TEXT NOT NULL,
                volume REAL NOT NULL,
                sl REAL NOT NULL,
                tp REAL NOT NULL,
                ticket INTEGER NOT NULL,
                position_ticket INTEGER NOT NULL,
                price REAL NOT NULL,
                filled_volume REAL NOT NULL DEFAULT 0,
                partial INTEGER NOT NULL DEFAULT 0,
                pending INTEGER NOT NULL DEFAULT 0,
                accepted_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS control_state (
                state_key TEXT PRIMARY KEY,
                state_value TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "INSERT OR IGNORE INTO control_state (state_key, state_value) VALUES ('trading_halted', 'false')"
        )
        connection.execute(
            "INSERT OR IGNORE INTO control_state (state_key, state_value) VALUES ('auto_trade', 'false')"
        )
        columns = {row[1] for row in connection.execute("PRAGMA table_info(order_requests)")}
        if "poi_key" not in columns:
            connection.execute("ALTER TABLE order_requests ADD COLUMN poi_key TEXT NOT NULL DEFAULT ''")
        if "filled_volume" not in columns:
            connection.execute("ALTER TABLE order_requests ADD COLUMN filled_volume REAL NOT NULL DEFAULT 0")
            connection.execute("UPDATE order_requests SET filled_volume = volume")
        if "partial" not in columns:
            connection.execute("ALTER TABLE order_requests ADD COLUMN partial INTEGER NOT NULL DEFAULT 0")
        if "pending" not in columns:
            connection.execute("ALTER TABLE order_requests ADD COLUMN pending INTEGER NOT NULL DEFAULT 0")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_risk (
                account_login INTEGER NOT NULL,
                account_server TEXT NOT NULL,
                utc_date TEXT NOT NULL,
                start_balance REAL NOT NULL,
                PRIMARY KEY (account_login, account_server, utc_date)
            )
            """
        )


initialize_state_database()


def configured_news_blackout(now: datetime) -> bool:
    local_time = now.astimezone(ZoneInfo(RISK_CONFIG["newsBlackoutTimeZone"])).strftime("%H:%M")
    return any(window["start"] <= local_time < window["end"] for window in RISK_CONFIG["newsBlackoutWindows"])


def get_symbol_spec(login: int, server: str, symbol: str, info: Any) -> dict:
    key = (login, server, symbol)
    if key not in _symbol_spec_cache:
        spec = {
            "point": float(info.point),
            "tickSize": float(info.trade_tick_size),
            "tickValue": float(info.trade_tick_value),
            "contractSize": float(info.trade_contract_size),
            "volumeMin": float(info.volume_min),
            "volumeMax": float(info.volume_max),
            "volumeStep": float(info.volume_step),
            "tradeStopsLevel": int(info.trade_stops_level),
            "tradeFreezeLevel": int(info.trade_freeze_level),
        }
        if any(not math.isfinite(value) for value in spec.values()):
            raise HTTPException(status_code=503, detail="MT5 returned non-finite symbol risk specifications.")
        _symbol_spec_cache[key] = spec
    return _symbol_spec_cache[key]


def idempotent_order(handler):
    @wraps(handler)
    def wrapped(payload: TradeRequest, request: Request):
        require_bridge_token(request)
        account = require_account()
        if account["login"] != payload.expectedLogin or account["server"] != payload.expectedServer:
            raise HTTPException(status_code=409, detail="The logged-in MT5 account changed since dashboard verification.")
        order_id = payload.clientOrderId
        with _order_id_lock:
            if order_id in _inflight_order_requests:
                raise HTTPException(status_code=409, detail="This order request is already being processed.")
            with sqlite3.connect(STATE_DATABASE) as connection:
                cached = connection.execute(
                    """
                    SELECT account_login, account_server, symbol, direction, volume, sl, tp,
                           ticket, position_ticket, price, poi_key, filled_volume, partial, pending
                    FROM order_requests WHERE client_order_id = ?
                    """,
                    (order_id,),
                ).fetchone()
            if cached is not None:
                expected = (
                    payload.expectedLogin, payload.expectedServer, payload.symbol.strip(),
                    payload.direction, payload.volume, payload.sl, payload.tp,
                )
                if cached[:7] != expected or cached[10] != payload.poiKey:
                    raise HTTPException(status_code=409, detail="Idempotency key was already used for different order parameters.")
                return {
                    "ok": True,
                    "ticket": cached[7],
                    "positionTicket": cached[8],
                    "price": cached[9],
                    "filledVolume": cached[11],
                    "partial": bool(cached[12]),
                    "pending": bool(cached[13]),
                    **read_snapshot(payload.symbol.strip()),
                }
            _inflight_order_requests.add(order_id)
        try:
            with _trade_execution_lock:
                response = handler(payload, request)
        except Exception:
            with _order_id_lock:
                _inflight_order_requests.discard(order_id)
            raise
        with _order_id_lock:
            _inflight_order_requests.discard(order_id)
        return response

    return wrapped


class ConnectRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)


class TradeRequest(BaseModel):
    direction: Literal["BUY", "SELL"]
    instrumentType: Literal["standard", "synthetic"] = "standard"
    volume: float = Field(gt=0, le=100)
    symbol: str = Field(min_length=1, max_length=32)
    sl: float
    tp: float
    rationale: str = Field(default="", max_length=1000)
    expectedLogin: int = Field(gt=0)
    expectedServer: str = Field(min_length=1, max_length=128)
    clientOrderId: str = Field(min_length=1, max_length=160)
    poiKey: str = Field(min_length=1, max_length=160)
    signalTimeframe: Literal["M1", "M5"]
    signalTimestamp: str = Field(min_length=1, max_length=40)
    magic: int | None = None


class TradingControlRequest(BaseModel):
    tradingHalted: bool


class AutoTradeControlRequest(BaseModel):
    autoTrade: bool


class CloseRequest(BaseModel):
    ticket: int = Field(gt=0)
    expectedLogin: int = Field(gt=0)
    expectedServer: str = Field(min_length=1, max_length=128)


class StopsRequest(BaseModel):
    ticket: int = Field(gt=0)
    sl: float = Field(ge=0)
    tp: float = Field(ge=0)
    expectedLogin: int = Field(gt=0)
    expectedServer: str = Field(min_length=1, max_length=128)


def require_bridge_token(request: Request) -> None:
    expected = os.environ.get("SMC_BRIDGE_TOKEN", "")
    authorization = request.headers.get("authorization", "")
    scheme, _, supplied = authorization.partition(" ")
    if not expected:
        raise HTTPException(status_code=503, detail="MT5 bridge token is not configured on the host.")
    if scheme.lower() != "bearer" or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="A valid MT5 bridge token is required.")


def require_account() -> dict:
    if mt5.terminal_info() is None and not mt5.initialize():
        raise HTTPException(
            status_code=503,
            detail=f"Could not attach to MT5 Desktop. Open MT5 and log into your trading account first: {mt5.last_error()}",
        )
    account = mt5.account_info()
    if account is None:
        raise HTTPException(status_code=503, detail=f"MT5 account unavailable: {mt5.last_error()}")
    return {
        "login": int(account.login),
        "server": str(account.server),
        "balance": float(account.balance),
        "equity": float(account.equity),
        "margin_free": float(account.margin_free),
        "trade_mode": int(account.trade_mode),
    }


def require_expected_account(login: int, server: str) -> None:
    account = require_account()
    if account["login"] != login or account["server"] != server:
        raise HTTPException(status_code=409, detail="The logged-in MT5 account changed. Reconnect before modifying positions.")


def read_positions() -> list[dict]:
    positions = mt5.positions_get()
    if positions is None:
        raise HTTPException(status_code=503, detail=f"MT5 positions unavailable: {mt5.last_error()}")
    return [
        {
            "ticket": int(position.ticket),
            "symbol": str(position.symbol),
            "type": "BUY" if position.type == mt5.POSITION_TYPE_BUY else "SELL",
            "volume": float(position.volume),
            "price_open": float(position.price_open),
            "sl": float(position.sl),
            "tp": float(position.tp),
            "profit": float(position.profit),
            "magic": int(position.magic),
            "comment": str(position.comment),
            "time": datetime.fromtimestamp(position.time, timezone.utc).strftime("%H:%M:%S"),
        }
        for position in positions
    ]


def read_snapshot(symbol: str) -> dict:
    account = require_account()
    positions = read_positions()
    if not mt5.symbol_select(symbol, True):
        raise HTTPException(status_code=400, detail=f"MT5 could not select symbol {symbol!r}.")
    info = mt5.symbol_info(symbol)
    tick = mt5.symbol_info_tick(symbol)
    if info is None or tick is None:
        raise HTTPException(status_code=503, detail=f"No current MT5 quote for {symbol!r}.")
    symbol_spec = get_symbol_spec(account["login"], account["server"], symbol, info)
    if info.point <= 0 or tick.bid <= 0 or tick.ask <= 0:
        raise HTTPException(status_code=503, detail=f"MT5 returned an invalid quote for {symbol!r}.")
    account_mode = {
        mt5.ACCOUNT_TRADE_MODE_DEMO: "demo",
        mt5.ACCOUNT_TRADE_MODE_REAL: "live",
        mt5.ACCOUNT_TRADE_MODE_CONTEST: "contest",
    }.get(account["trade_mode"], "unknown")
    account.pop("trade_mode")
    with sqlite3.connect(STATE_DATABASE) as connection:
        connection.execute(
            """
            INSERT OR IGNORE INTO daily_risk (account_login, account_server, utc_date, start_balance)
            VALUES (?, ?, ?, ?)
            """,
            (account["login"], account["server"], datetime.now(timezone.utc).date().isoformat(), account["balance"]),
        )
        trading_halted = connection.execute(
            "SELECT state_value FROM control_state WHERE state_key = 'trading_halted'"
        ).fetchone()[0] == "true"
        auto_trade = connection.execute(
            "SELECT state_value FROM control_state WHERE state_key = 'auto_trade'"
        ).fetchone()[0] == "true"

    def candles(timeframe: int) -> list[dict]:
        rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, 100)
        if rates is None:
            return []
        return [
            {
                "time": int(rate["time"]) * 1000,
                "timeStr": datetime.fromtimestamp(int(rate["time"]), timezone.utc).strftime("%H:%M"),
                "open": float(rate["open"]),
                "high": float(rate["high"]),
                "low": float(rate["low"]),
                "close": float(rate["close"]),
                "volume": float(rate["tick_volume"]),
            }
            for rate in rates[:-1]
        ]

    return {
         "account": account,
         "positions": positions,
         "symbol": symbol,
         "accountMode": account_mode,
         "tradingHalted": trading_halted,
         "autoTrade": auto_trade,
         "symbolSpec": symbol_spec,
        "bid": float(tick.bid),
        "ask": float(tick.ask),
        "spread": round((tick.ask - tick.bid) / info.point),
        "candlesM1": candles(mt5.TIMEFRAME_M1),
        "candlesM5": candles(mt5.TIMEFRAME_M5),
        "candlesM15": candles(mt5.TIMEFRAME_M15),
        "candlesH1": candles(mt5.TIMEFRAME_H1),
    }


def _deal_time(deal: Any) -> datetime:
    return datetime.fromtimestamp(int(deal.time), timezone.utc)


def _deal_cost(deal: Any) -> float:
    return (
        float(deal.profit)
        + float(deal.swap)
        + float(deal.commission)
        + float(getattr(deal, "fee", 0.0))
    )


def read_closed_trades(days: int, symbol: str) -> list[dict]:
    require_account()
    now = datetime.now(timezone.utc)
    deals = mt5.history_deals_get(now - timedelta(days=days), now)
    if deals is None:
        raise HTTPException(status_code=503, detail=f"MT5 deal history unavailable: {mt5.last_error()}")

    open_positions = mt5.positions_get()
    if open_positions is None:
        raise HTTPException(status_code=503, detail=f"MT5 positions unavailable: {mt5.last_error()}")
    open_position_ids = {int(position.ticket) for position in open_positions}
    deals_by_position: dict[int, list[Any]] = {}
    for deal in deals:
        if str(deal.symbol) == symbol:
            deals_by_position.setdefault(int(deal.position_id), []).append(deal)

    exits_by_position: dict[int, list[Any]] = {}
    for position_id, position_deals in deals_by_position.items():
        if position_id in open_position_ids:
            continue
        exits = [
            deal
            for deal in position_deals
            if deal.entry in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_OUT_BY, mt5.DEAL_ENTRY_INOUT)
        ]
        if exits:
            exits_by_position[position_id] = exits

    results: list[dict] = []
    for position_id, exits in exits_by_position.items():
        position_deals = deals_by_position[position_id]
        entries = [deal for deal in position_deals if deal.entry == mt5.DEAL_ENTRY_IN]
        if not entries:
            historical_position_deals = mt5.history_deals_get(position=position_id)
            if historical_position_deals is None:
                raise HTTPException(
                    status_code=503,
                    detail=f"MT5 deal history unavailable for closed position {position_id}: {mt5.last_error()}",
                )
            position_deals = [
                deal for deal in historical_position_deals if str(deal.symbol) == symbol
            ]
            entries = [deal for deal in position_deals if deal.entry == mt5.DEAL_ENTRY_IN]
        if not entries:
            continue

        entry = min(entries, key=lambda deal: int(deal.time))
        last_exit = max(exits, key=lambda deal: int(deal.time))
        exit_volume = sum(float(deal.volume) for deal in exits)
        close_price = (
            sum(float(deal.price) * float(deal.volume) for deal in exits) / exit_volume
            if exit_volume
            else float(last_exit.price)
        )
        direction = "BUY" if entry.type == mt5.DEAL_TYPE_BUY else "SELL"
        price_delta = close_price - float(entry.price)
        if direction == "SELL":
            price_delta = -price_delta
        reason_by_code = {
            mt5.DEAL_REASON_TP: "TP",
            mt5.DEAL_REASON_SL: "SL",
        }
        rationale = str(entry.comment).strip()
        open_time = _deal_time(entry)
        close_time = _deal_time(last_exit)
        results.append(
            {
                "ticket": int(last_exit.ticket),
                "orderTicket": int(entry.order),
                "positionTicket": position_id,
                "openTime": open_time.strftime("%H:%M:%S"),
                "closeTime": close_time.strftime("%H:%M:%S"),
                "closedAt": close_time.isoformat(),
                "type": direction,
                "volume": float(entry.volume),
                "openPrice": float(entry.price),
                "closePrice": close_price,
                "profit": sum(_deal_cost(deal) for deal in position_deals),
                "pips": price_delta * 10,
                "reason": reason_by_code.get(last_exit.reason, "Manual"),
                "comment": str(last_exit.comment),
                "strategyRationale": rationale if rationale and rationale != "SMC dashboard" else None,
            }
        )

    results.sort(key=lambda trade: trade["closedAt"], reverse=True)
    return results[:1000]


@app.get("/ping")
def ping(request: Request) -> dict:
    require_bridge_token(request)
    account = require_account()
    return {"status": "ok", "connected": True, "login": account["login"], "server": account["server"]}


@app.post("/api/connect")
def connect(payload: ConnectRequest, request: Request) -> dict:
    require_bridge_token(request)
    return read_snapshot(payload.symbol)


@app.get("/api/account")
def account(request: Request, symbol: str = "XAUUSD") -> dict:
    require_bridge_token(request)
    return read_snapshot(symbol)


@app.post("/api/trading-control")
def set_trading_control(payload: TradingControlRequest, request: Request) -> dict:
    require_bridge_token(request)
    with sqlite3.connect(STATE_DATABASE) as connection:
        connection.execute(
            "UPDATE control_state SET state_value = ? WHERE state_key = 'trading_halted'",
            ("true" if payload.tradingHalted else "false",),
        )
    return {"tradingHalted": payload.tradingHalted}


@app.post("/api/auto-trade-control")
def set_auto_trade_control(payload: AutoTradeControlRequest, request: Request) -> dict:
    require_bridge_token(request)
    with sqlite3.connect(STATE_DATABASE) as connection:
        connection.execute(
            "UPDATE control_state SET state_value = ? WHERE state_key = 'auto_trade'",
            ("true" if payload.autoTrade else "false",),
        )
    return {"autoTrade": payload.autoTrade}


@app.get("/api/history")
def history(
    request: Request,
    days: int = Query(default=180, ge=1, le=365),
    symbol: str = Query(default="XAUUSD", min_length=1, max_length=32),
) -> list[dict]:
    require_bridge_token(request)
    return read_closed_trades(days, symbol.strip())


@app.post("/api/trade")
@idempotent_order
def place_trade(payload: TradeRequest, request: Request) -> dict:
    require_bridge_token(request)
    account = require_account()
    if account["login"] != payload.expectedLogin or account["server"] != payload.expectedServer:
        raise HTTPException(
            status_code=409,
            detail="The logged-in MT5 account changed since dashboard verification. Reconnect before placing orders.",
        )
    now = datetime.now(timezone.utc)
    try:
        signal_bar_time = datetime.fromisoformat(payload.signalTimestamp.replace("Z", "+00:00"))
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Signal candle timestamp is invalid.") from error
    if signal_bar_time.tzinfo is None:
        raise HTTPException(status_code=400, detail="Signal candle timestamp must include a timezone.")
    signal_bar_time = signal_bar_time.astimezone(timezone.utc)
    if signal_bar_time > now + timedelta(seconds=5):
        raise HTTPException(status_code=400, detail="Signal candle timestamp is in the future.")
    signal_age_limit = timedelta(minutes=1 if payload.signalTimeframe == "M1" else 5) * 3
    if now - signal_bar_time > signal_age_limit:
        raise HTTPException(status_code=409, detail="Signal candle is stale; wait for a new broker-confirmed setup.")
    with sqlite3.connect(STATE_DATABASE) as connection:
        trading_halted = connection.execute(
            "SELECT state_value FROM control_state WHERE state_key = 'trading_halted'"
        ).fetchone()[0] == "true"
    if trading_halted:
        raise HTTPException(status_code=423, detail="Central MT5 kill switch is armed.")
    if payload.instrumentType == "standard" and configured_news_blackout(now):
        raise HTTPException(status_code=423, detail="Configured high-impact news blackout window is active.")

    symbol = payload.symbol.strip()
    if not mt5.symbol_select(symbol, True):
        raise HTTPException(status_code=400, detail=f"MT5 could not select symbol {symbol!r}.")

    info = mt5.symbol_info(symbol)
    tick = mt5.symbol_info_tick(symbol)
    if info is None or tick is None:
        raise HTTPException(status_code=503, detail=f"No current MT5 quote for {symbol!r}.")
    symbol_spec = get_symbol_spec(account["login"], account["server"], symbol, info)
    if (
        symbol_spec["tickSize"] <= 0
        or symbol_spec["tickValue"] <= 0
        or symbol_spec["contractSize"] <= 0
        or symbol_spec["volumeMin"] <= 0
        or symbol_spec["volumeStep"] <= 0
    ):
        raise HTTPException(status_code=503, detail="Broker symbol risk specifications are incomplete; order sizing is disabled.")
    price = tick.ask if payload.direction == "BUY" else tick.bid
    if not all(math.isfinite(value) for value in (payload.volume, payload.sl, payload.tp)):
        raise HTTPException(status_code=400, detail="Volume and protective levels must be finite numbers.")
    if payload.volume < symbol_spec["volumeMin"] or payload.volume > symbol_spec["volumeMax"]:
        raise HTTPException(
            status_code=400,
            detail=f"Volume must be between {symbol_spec['volumeMin']} and {symbol_spec['volumeMax']} lots for {symbol}.",
        )
    step_count = round((payload.volume - symbol_spec["volumeMin"]) / symbol_spec["volumeStep"])
    if abs(symbol_spec["volumeMin"] + step_count * symbol_spec["volumeStep"] - payload.volume) > 1e-8:
        raise HTTPException(status_code=400, detail=f"Volume must use {symbol_spec['volumeStep']} lot increments.")
    stop_distance = abs(price - payload.sl)
    risk_per_lot = stop_distance / symbol_spec["tickSize"] * symbol_spec["tickValue"]
    risk_budget = account["equity"] * RISK_CONFIG["riskPercentPerTrade"] / 100
    max_safe_volume = risk_budget / risk_per_lot if risk_per_lot > 0 else 0
    safe_step_count = math.floor((max_safe_volume - symbol_spec["volumeMin"]) / symbol_spec["volumeStep"] + 1e-9)
    safe_volume = symbol_spec["volumeMin"] + max(0, safe_step_count) * symbol_spec["volumeStep"]
    if max_safe_volume < symbol_spec["volumeMin"] or payload.volume > safe_volume + 1e-9:
        raise HTTPException(
            status_code=400,
            detail=f"Requested volume exceeds the configured {RISK_CONFIG['riskPercentPerTrade']}% equity risk for this stop.",
        )

    open_positions = read_positions()
    if len(open_positions) >= RISK_CONFIG["maxOpenPositions"]:
        raise HTTPException(status_code=423, detail="Maximum open-position limit reached.")
    with sqlite3.connect(STATE_DATABASE) as connection:
        connection.execute(
            """
            INSERT OR IGNORE INTO daily_risk (account_login, account_server, utc_date, start_balance)
            VALUES (?, ?, ?, ?)
            """,
            (account["login"], account["server"], now.date().isoformat(), account["balance"]),
        )
        day_start = connection.execute(
            """
            SELECT start_balance FROM daily_risk
            WHERE account_login = ? AND account_server = ? AND utc_date = ?
            """,
            (account["login"], account["server"], now.date().isoformat()),
        ).fetchone()
    if day_start and account["equity"] <= day_start[0] * (1 - RISK_CONFIG["maxDailyLossPercent"] / 100):
        raise HTTPException(status_code=423, detail="Broker account daily-loss circuit breaker reached.")

    recent_losses = read_closed_trades(1, symbol)
    if len(recent_losses) >= RISK_CONFIG["maxConsecutiveLosses"] and all(
        trade["profit"] <= 0 for trade in recent_losses[:RISK_CONFIG["maxConsecutiveLosses"]]
    ):
        raise HTTPException(status_code=423, detail="Consecutive-loss circuit breaker reached.")

    with sqlite3.connect(STATE_DATABASE) as connection:
        recent_count = connection.execute(
            "SELECT COUNT(*) FROM order_requests WHERE account_login = ? AND account_server = ? AND accepted_at >= ?",
            (account["login"], account["server"], (now - timedelta(hours=1)).isoformat()),
        ).fetchone()[0]
        recent_direction = connection.execute(
            """
            SELECT accepted_at FROM order_requests
            WHERE account_login = ? AND account_server = ? AND direction = ?
            ORDER BY accepted_at DESC LIMIT 1
            """,
            (account["login"], account["server"], payload.direction),
        ).fetchone()
        recent_poi = connection.execute(
            """
            SELECT 1 FROM order_requests
            WHERE account_login = ? AND account_server = ? AND poi_key = ? AND accepted_at >= ?
            LIMIT 1
            """,
            (
                account["login"],
                account["server"],
                payload.poiKey,
                (now - timedelta(minutes=RISK_CONFIG["samePoiCooldownMinutes"])).isoformat(),
            ),
        ).fetchone()
    if recent_count >= RISK_CONFIG["maxTradesPerHour"]:
        raise HTTPException(status_code=423, detail="Hourly order limit reached.")
    if recent_direction:
        last_direction_time = datetime.fromisoformat(recent_direction[0])
        if now - last_direction_time < timedelta(minutes=RISK_CONFIG["directionCooldownMinutes"]):
            raise HTTPException(status_code=423, detail="Direction cooldown is active.")
    if recent_poi:
        raise HTTPException(status_code=423, detail="This SMC point of interest was recently traded.")

    order_type = mt5.ORDER_TYPE_BUY if payload.direction == "BUY" else mt5.ORDER_TYPE_SELL
    if payload.direction == "BUY" and not (payload.sl < price < payload.tp):
        raise HTTPException(status_code=400, detail="For a BUY, require stop loss < current ask < take profit.")
    if payload.direction == "SELL" and not (payload.tp < price < payload.sl):
        raise HTTPException(status_code=400, detail="For a SELL, require take profit < current bid < stop loss.")
    min_stop_distance = symbol_spec["tradeStopsLevel"] * info.point
    if min_stop_distance and (
        abs(price - payload.sl) < min_stop_distance or abs(payload.tp - price) < min_stop_distance
    ):
        raise HTTPException(status_code=400, detail=f"Stops must be at least {min_stop_distance} price units from market.")
    for level in (payload.sl, payload.tp):
        if abs(level / symbol_spec["tickSize"] - round(level / symbol_spec["tickSize"])) > 1e-6:
            raise HTTPException(status_code=400, detail=f"Protective price levels must align to tick size {symbol_spec['tickSize']}.")

    filling = (
        mt5.ORDER_FILLING_IOC
        if info.filling_mode & mt5.SYMBOL_FILLING_IOC
        else mt5.ORDER_FILLING_FOK
        if info.filling_mode & mt5.SYMBOL_FILLING_FOK
        else mt5.ORDER_FILLING_RETURN
    )
    rationale_comment = "".join(
        character
        for character in payload.rationale
        if character.isascii() and character.isprintable()
    )[:25]
    request_data = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": payload.volume,
        "type": order_type,
        "price": price,
        "sl": payload.sl,
        "tp": payload.tp,
        "deviation": 20,
        "magic": payload.magic or {
            "EURUSD": 10001,
            "USDJPY": 10002,
            "GBPUSD": 10003,
            "XAUUSD": 20261001,
        }.get(symbol.upper(), 20261001),
        "comment": f"SMC: {rationale_comment}" if rationale_comment else "SMC dashboard",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": filling,
    }
    result = mt5.order_send(request_data)
    if result is None:
        raise HTTPException(status_code=502, detail=f"MT5 order request failed: {mt5.last_error()}")
    accepted_ret_codes = (mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED, mt5.TRADE_RETCODE_DONE_PARTIAL)
    if result.retcode not in accepted_ret_codes:
        raise HTTPException(
            status_code=502,
            detail=f"MT5 rejected order ({result.retcode}): {result.comment}",
        )
    snapshot = read_snapshot(symbol)
    position_ticket = int(result.order or result.deal)
    if result.deal:
        deal_matches = mt5.history_deals_get(ticket=int(result.deal))
        if deal_matches:
            position_ticket = int(deal_matches[0].position_id)

    response_ticket = int(result.order or result.deal)
    execution_price = float(result.price or price)
    with sqlite3.connect(STATE_DATABASE) as connection:
        connection.execute(
            """
            INSERT OR IGNORE INTO order_requests
            (client_order_id, account_login, account_server, symbol, poi_key, direction, volume, sl, tp,
             ticket, position_ticket, price, filled_volume, partial, pending, accepted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.clientOrderId, account["login"], account["server"], symbol, payload.poiKey, payload.direction,
                payload.volume, payload.sl, payload.tp, response_ticket, position_ticket,
                execution_price, float(result.volume or 0),
                int(result.retcode == mt5.TRADE_RETCODE_DONE_PARTIAL),
                int(result.retcode == mt5.TRADE_RETCODE_PLACED), now.isoformat(),
            ),
        )
    return {
        "ok": True,
        "ticket": response_ticket,
        "positionTicket": position_ticket,
        "price": execution_price,
        "filledVolume": float(result.volume or 0),
        "partial": result.retcode == mt5.TRADE_RETCODE_DONE_PARTIAL,
        "pending": result.retcode == mt5.TRADE_RETCODE_PLACED,
        **snapshot,
    }


@app.post("/api/close")
def close_position(payload: CloseRequest, request: Request) -> dict:
    require_bridge_token(request)
    require_expected_account(payload.expectedLogin, payload.expectedServer)
    matches = mt5.positions_get(ticket=payload.ticket)
    if not matches:
        raise HTTPException(status_code=404, detail=f"Open MT5 position {payload.ticket} was not found.")
    position = matches[0]
    tick = mt5.symbol_info_tick(position.symbol)
    info = mt5.symbol_info(position.symbol)
    if tick is None or info is None:
        raise HTTPException(status_code=503, detail=f"No current MT5 quote for {position.symbol!r}.")
    is_buy = position.type == mt5.POSITION_TYPE_BUY
    filling = (
        mt5.ORDER_FILLING_IOC
        if info.filling_mode & mt5.SYMBOL_FILLING_IOC
        else mt5.ORDER_FILLING_FOK
        if info.filling_mode & mt5.SYMBOL_FILLING_FOK
        else mt5.ORDER_FILLING_RETURN
    )
    result = mt5.order_send(
        {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": position.symbol,
            "volume": float(position.volume),
            "type": mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY,
            "position": int(position.ticket),
            "price": float(tick.bid if is_buy else tick.ask),
            "deviation": 20,
            "magic": int(position.magic),
            "comment": "SMC dashboard close",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling,
        }
    )
    if result is None or result.retcode not in (
        mt5.TRADE_RETCODE_DONE,
        mt5.TRADE_RETCODE_PLACED,
        mt5.TRADE_RETCODE_DONE_PARTIAL,
    ):
        reason = f"{result.retcode}: {result.comment}" if result else str(mt5.last_error())
        raise HTTPException(status_code=502, detail=f"MT5 close request failed: {reason}")
    return read_snapshot(position.symbol)


@app.post("/api/modify")
def modify_position(payload: StopsRequest, request: Request) -> dict:
    require_bridge_token(request)
    require_expected_account(payload.expectedLogin, payload.expectedServer)
    matches = mt5.positions_get(ticket=payload.ticket)
    if not matches:
        raise HTTPException(status_code=404, detail=f"Open MT5 position {payload.ticket} was not found.")
    position = matches[0]
    tick = mt5.symbol_info_tick(position.symbol)
    info = mt5.symbol_info(position.symbol)
    if tick is None or info is None:
        raise HTTPException(status_code=503, detail=f"No current MT5 quote for {position.symbol!r}.")
    spec = get_symbol_spec(payload.expectedLogin, payload.expectedServer, position.symbol, info)
    if info.point <= 0 or spec["tickSize"] <= 0:
        raise HTTPException(status_code=503, detail=f"Broker price specifications are incomplete for {position.symbol!r}.")
    is_buy = position.type == mt5.POSITION_TYPE_BUY
    point = info.point
    freeze_distance = spec["tradeFreezeLevel"] * point
    min_stop_distance = spec["tradeStopsLevel"] * point
    market_price = float(tick.bid if is_buy else tick.ask)
    if freeze_distance and any(
        level > 0 and abs(market_price - level) < freeze_distance
        for level in (payload.sl, payload.tp)
    ):
        raise HTTPException(status_code=400, detail=f"Stops are inside the broker freeze distance ({freeze_distance}).")
    if min_stop_distance and any(
        level > 0 and abs(market_price - level) < min_stop_distance
        for level in (payload.sl, payload.tp)
    ):
        raise HTTPException(status_code=400, detail=f"Stops are inside the broker minimum stop distance ({min_stop_distance}).")
    for level in (payload.sl, payload.tp):
        if level > 0 and abs(level / spec["tickSize"] - round(level / spec["tickSize"])) > 1e-6:
            raise HTTPException(status_code=400, detail=f"Protective price levels must align to tick size {spec['tickSize']}.")
    if is_buy and (
        (payload.sl > 0 and payload.sl >= tick.bid)
        or (payload.tp > 0 and payload.tp <= tick.bid)
    ):
        raise HTTPException(status_code=400, detail="BUY stop loss must be below bid and take profit above bid.")
    if not is_buy and (
        (payload.sl > 0 and payload.sl <= tick.ask)
        or (payload.tp > 0 and payload.tp >= tick.ask)
    ):
        raise HTTPException(status_code=400, detail="SELL stop loss must be above ask and take profit below ask.")
    result = mt5.order_send(
        {
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": position.symbol,
            "position": int(position.ticket),
            "sl": payload.sl,
            "tp": payload.tp,
        }
    )
    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        reason = f"{result.retcode}: {result.comment}" if result else str(mt5.last_error())
        raise HTTPException(status_code=502, detail=f"MT5 stop update failed: {reason}")
    return read_snapshot(position.symbol)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)

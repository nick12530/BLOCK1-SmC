"""Local-only FastAPI bridge for a MetaTrader 5 terminal on Windows."""

from __future__ import annotations

import math
import os
import re
import hmac
import json
import logging
import sqlite3
import threading
from functools import wraps
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, cast
from zoneinfo import ZoneInfo

logger = logging.getLogger("mt5_bridge")

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


def get_safe_timezone(tz_name: str) -> timezone:
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(tz_name)
    except Exception:
        # Fallback for Windows systems without tzdata installed
        # America/New_York is UTC-4 in summer (EDT), UTC-5 in winter (EST)
        now_utc = datetime.now(timezone.utc)
        month = now_utc.month
        is_dst = 3 < month < 11
        if month == 3:
            is_dst = now_utc.day >= 8 and (now_utc.weekday() == 6 or now_utc.day >= 14)
        elif month == 11:
            is_dst = now_utc.day < 7 and now_utc.weekday() != 6
        offset_hours = -4 if is_dst else -5
        return timezone(timedelta(hours=offset_hours))


def configured_news_blackout(now: datetime) -> bool:
    try:
        tz = get_safe_timezone(RISK_CONFIG.get("newsBlackoutTimeZone", "America/New_York"))
        local_time = now.astimezone(tz).strftime("%H:%M")
        return any(window["start"] <= local_time < window["end"] for window in RISK_CONFIG.get("newsBlackoutWindows", []))
    except Exception:
        return False


def resolve_broker_symbol(symbol: str) -> str:
    cleaned = (symbol or "").strip()
    if not cleaned:
        return cleaned

    # 1. Exact match in MT5
    info = mt5.symbol_info(cleaned)
    if info is not None:
        return cleaned

    try:
        all_symbols = mt5.symbols_get()
        if not all_symbols:
            return cleaned

        upper_clean = cleaned.upper().replace("/", "")

        # 2. Case-insensitive exact match
        for s in all_symbols:
            if s.name.upper() == upper_clean:
                return s.name

        # 3. Match broker suffix (e.g. XAUUSD matches XAUUSD.vx, XAUUSDm, XAUUSD.r, XAUUSDpro)
        candidates = [s.name for s in all_symbols if s.name.upper().startswith(upper_clean)]
        if candidates:
            visible = [c for c in candidates if (sym_info := mt5.symbol_info(c)) and getattr(sym_info, "visible", True)]
            return visible[0] if visible else candidates[0]

        # 4. Match embedded symbol (e.g. mEURUSD, pro.EURUSD)
        contains_candidates = [s.name for s in all_symbols if upper_clean in s.name.upper()]
        if contains_candidates:
            visible = [c for c in contains_candidates if (sym_info := mt5.symbol_info(c)) and getattr(sym_info, "visible", True)]
            return visible[0] if visible else contains_candidates[0]

        # 5. Gold alias match (e.g. XAUUSD <-> GOLD)
        if "XAU" in upper_clean or "GOLD" in upper_clean:
            gold_candidates = [s.name for s in all_symbols if "XAUUSD" in s.name.upper() or "GOLD" in s.name.upper()]
            if gold_candidates:
                visible = [c for c in gold_candidates if (sym_info := mt5.symbol_info(c)) and getattr(sym_info, "visible", True)]
                return visible[0] if visible else gold_candidates[0]
    except Exception:
        pass

    return cleaned


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
    poiKey: str = Field(default="", max_length=160)
    signalTimeframe: Literal["M1", "M5", "M15"] = "M1"
    signalTimestamp: str = Field(default="", max_length=40)
    magic: int | None = None
    bypassCooldown: bool = False
    forceExecute: bool = False


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
    if not expected:
        # Allow open access if bridge token is not configured on the host
        return
    authorization = request.headers.get("authorization", "")
    scheme, _, supplied = authorization.partition(" ")
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
        "leverage": int(getattr(account, "leverage", 2000) or 2000),
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
    resolved_symbol = resolve_broker_symbol(symbol)
    info = mt5.symbol_info(resolved_symbol)
    if info is None or not getattr(info, "visible", True):
        mt5.symbol_select(resolved_symbol, True)
        info = mt5.symbol_info(resolved_symbol)
    if info is None:
        raise HTTPException(status_code=400, detail=f"MT5 could not select symbol {resolved_symbol!r} (requested as {symbol!r}).")
    tick = mt5.symbol_info_tick(resolved_symbol)
    if info is None or tick is None:
        raise HTTPException(status_code=503, detail=f"No current MT5 quote for {resolved_symbol!r}.")
    symbol_spec = get_symbol_spec(account["login"], account["server"], resolved_symbol, info)
    if info.point <= 0 or tick.bid <= 0 or tick.ask <= 0:
        raise HTTPException(status_code=503, detail=f"MT5 returned an invalid quote for {resolved_symbol!r}.")
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
        rates = mt5.copy_rates_from_pos(resolved_symbol, timeframe, 0, 100)
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
         "symbol": resolved_symbol,
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
    resolved_symbol = resolve_broker_symbol(symbol)
    for deal in deals:
        deal_sym = str(deal.symbol)
        if deal_sym == symbol or deal_sym == resolved_symbol or deal_sym.startswith(symbol):
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


@app.get("/api/health")
@app.get("/ping")
def ping(request: Request) -> dict:
    account = None
    try:
        account = require_account()
    except Exception:
        pass
    if account:
        return {"status": "ok", "connected": True, "login": account["login"], "server": account["server"]}
    return {"status": "ok", "connected": False, "message": "MT5 Bridge active; waiting for MT5 terminal"}


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


def resolve_filling_mode(info) -> int:
    """Safely determine MT5 order filling mode from symbol info filling_mode bitmask.
    Uses mt5.ORDER_FILLING_IOC instead of non-existent mt5.SYMBOL_FILLING_IOC attribute.
    Checks if symbol supports IOC (Bit 1 / value 2), falling back to FOK (Bit 0 / value 1)
    if IOC is unavailable, or ORDER_FILLING_RETURN to prevent 500 Internal Server Errors."""
    try:
        mode = getattr(info, "filling_mode", 0) if info else 0
        # Check if IOC (Immediate or Cancel) is supported
        if mode & 2:
            return getattr(mt5, "ORDER_FILLING_IOC", 1)
        # Fall back to FOK (Fill or Kill) if IOC is unavailable
        if mode & 1:
            return getattr(mt5, "ORDER_FILLING_FOK", 0)
        return getattr(mt5, "ORDER_FILLING_RETURN", getattr(mt5, "ORDER_FILLING_IOC", 1))
    except Exception as exc:
        logger.warning("Error determining filling mode: %s; falling back to ORDER_FILLING_IOC", exc)
        return getattr(mt5, "ORDER_FILLING_IOC", 1)


@app.post("/api/trade")
@idempotent_order
def place_trade(payload: TradeRequest, request: Request) -> dict:
    require_bridge_token(request)
    account = require_account()
    if payload.expectedLogin > 0 and (
        account["login"] != payload.expectedLogin
        or account["server"].strip().lower() != payload.expectedServer.strip().lower()
    ):
        raise HTTPException(
            status_code=409,
            detail="The logged-in MT5 account changed since dashboard verification. Reconnect before placing orders.",
        )
    now = datetime.now(timezone.utc)
    try:
        ts_str = (payload.signalTimestamp or "").strip()
        if not ts_str:
            signal_bar_time = now
        else:
            signal_bar_time = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            if signal_bar_time.tzinfo is None:
                signal_bar_time = signal_bar_time.replace(tzinfo=timezone.utc)
            signal_bar_time = signal_bar_time.astimezone(timezone.utc)
    except Exception as error:
        logger.warning("Failed parsing signal timestamp %r: %s; using current time.", payload.signalTimestamp, error)
        signal_bar_time = now

    # Clock skew and broker timezone offset resilience:
    # MetaTrader 5 brokers frequently operate on GMT+2 / GMT+3 (Cyprus/EET) or local time,
    # causing raw broker candle timestamps to appear hours ahead of client UTC.
    # Gracefully clamp future timestamps to `now` rather than blocking valid trade execution.
    if signal_bar_time > now:
        signal_bar_time = now

    if not payload.bypassCooldown and not payload.forceExecute:
        tf_mins = 1 if payload.signalTimeframe == "M1" else 15 if payload.signalTimeframe == "M15" else 5
        signal_age_limit = timedelta(minutes=tf_mins) * 60
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

    raw_symbol = payload.symbol.strip()
    symbol = resolve_broker_symbol(raw_symbol)
    info = mt5.symbol_info(symbol)
    if info is None or not getattr(info, "visible", True):
        mt5.symbol_select(symbol, True)
        info = mt5.symbol_info(symbol)
    if info is None:
        raise HTTPException(status_code=400, detail=f"MT5 could not select symbol {symbol!r} (requested as {raw_symbol!r}).")

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
    vol_min = symbol_spec["volumeMin"]
    vol_max = symbol_spec["volumeMax"]
    vol_step = symbol_spec["volumeStep"]
    # Auto-align and clamp lot size to broker volume step
    step_count = round((payload.volume - vol_min) / vol_step)
    payload.volume = round(vol_min + max(0, step_count) * vol_step, 2)
    payload.volume = max(vol_min, min(vol_max, payload.volume))

    stop_distance = abs(price - payload.sl)
    risk_per_lot = stop_distance / symbol_spec["tickSize"] * symbol_spec["tickValue"]
    risk_budget = account["equity"] * RISK_CONFIG["riskPercentPerTrade"] / 100
    max_safe_volume = risk_budget / risk_per_lot if risk_per_lot > 0 else 0
    safe_step_count = math.floor((max_safe_volume - symbol_spec["volumeMin"]) / symbol_spec["volumeStep"] + 1e-9)
    safe_volume = symbol_spec["volumeMin"] + max(0, safe_step_count) * symbol_spec["volumeStep"]
    small_account_threshold = float(RISK_CONFIG.get("smallAccountThresholdUsd", 50))
    small_account_max_risk = float(RISK_CONFIG.get("smallAccountMaxRiskUsd", 2.5))
    is_small_account_micro = (
        account["equity"] <= small_account_threshold
        and payload.volume <= symbol_spec["volumeMin"] + 1e-9
        and (risk_per_lot * symbol_spec["volumeMin"]) <= small_account_max_risk
    )
    if not payload.forceExecute and not is_small_account_micro and (max_safe_volume < symbol_spec["volumeMin"] or payload.volume > safe_volume + 1e-9):
        # Auto-size down safely to allowable volume rather than failing order
        if safe_volume >= symbol_spec["volumeMin"]:
            payload.volume = safe_volume
        elif payload.volume > symbol_spec["volumeMin"] + 1e-9:
            payload.volume = symbol_spec["volumeMin"]

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
            "SELECT COUNT(*) FROM order_requests WHERE account_login = ? AND account_server = ? AND symbol = ? AND accepted_at >= ?",
            (account["login"], account["server"], symbol, (now - timedelta(hours=1)).isoformat()),
        ).fetchone()[0]
        recent_direction = connection.execute(
            """
            SELECT accepted_at FROM order_requests
            WHERE account_login = ? AND account_server = ? AND symbol = ? AND direction = ?
            ORDER BY accepted_at DESC LIMIT 1
            """,
            (account["login"], account["server"], symbol, payload.direction),
        ).fetchone()
        recent_poi = connection.execute(
            """
            SELECT 1 FROM order_requests
            WHERE account_login = ? AND account_server = ? AND symbol = ? AND poi_key = ? AND accepted_at >= ?
            LIMIT 1
            """,
            (
                account["login"],
                account["server"],
                symbol,
                payload.poiKey,
                (now - timedelta(minutes=RISK_CONFIG.get("samePoiCooldownMinutes", 1))).isoformat(),
            ),
        ).fetchone()
    # Direction cooldown and hourly trade limits
    allow_cooldown_bypass = (
        bool(payload.bypassCooldown)
        or bool(payload.forceExecute)
        or (not RISK_CONFIG.get("directionCooldownEnabled", False))
    )
    allow_hourly_bypass = (
        bool(payload.bypassCooldown)
        or bool(payload.forceExecute)
        or (not RISK_CONFIG.get("hourlyLimitEnabled", False))
    )

    if not allow_hourly_bypass:
        max_hourly = RISK_CONFIG.get("maxTradesPerHour", 100)
        if max_hourly > 0 and recent_count >= max_hourly:
            raise HTTPException(status_code=423, detail=f"Hourly order limit reached ({recent_count}/{max_hourly} for {symbol}).")

    if not allow_cooldown_bypass and recent_direction:
        last_direction_time = datetime.fromisoformat(recent_direction[0])
        cooldown_min = RISK_CONFIG.get("directionCooldownMinutes", 0)
        if cooldown_min > 0 and (now - last_direction_time < timedelta(minutes=cooldown_min)):
            raise HTTPException(status_code=423, detail=f"Direction cooldown is active for {symbol}.")

    same_poi_min = RISK_CONFIG.get("samePoiCooldownMinutes", 0)
    if not allow_cooldown_bypass and same_poi_min > 0 and recent_poi:
        raise HTTPException(status_code=423, detail=f"This SMC point of interest on {symbol} was recently traded.")

    order_type = mt5.ORDER_TYPE_BUY if payload.direction == "BUY" else mt5.ORDER_TYPE_SELL
    tick_size = symbol_spec.get("tickSize", 0.01) or 0.01
    digits = int(getattr(info, "digits", 2))
    point_val = float(getattr(info, "point", tick_size)) or tick_size
    min_stop_distance = max(float(symbol_spec.get("tradeStopsLevel", 0)) * point_val, tick_size * 5)

    # Auto-align SL and TP to valid tick sizes and broker limits instead of throwing 400 Bad Request
    if payload.sl:
        payload.sl = round(round(payload.sl / tick_size) * tick_size, digits)
    if payload.tp:
        payload.tp = round(round(payload.tp / tick_size) * tick_size, digits)

    if payload.direction == "BUY":
        if payload.sl >= price or abs(price - payload.sl) < min_stop_distance:
            payload.sl = round(price - min_stop_distance * 2, digits)
        if payload.tp <= price or abs(payload.tp - price) < min_stop_distance:
            payload.tp = round(price + min_stop_distance * 4, digits)
    else:
        if payload.sl <= price or abs(payload.sl - price) < min_stop_distance:
            payload.sl = round(price + min_stop_distance * 2, digits)
        if payload.tp >= price or abs(price - payload.tp) < min_stop_distance:
            payload.tp = round(price - min_stop_distance * 4, digits)

    # Target SL and TP requested
    desired_sl = float(payload.sl or 0.0)
    desired_tp = float(payload.tp or 0.0)

    # Determine execution mode: Market Execution (2) requires sl=0, tp=0 on entry deal
    trade_ex_mode = getattr(info, "trade_ex_mode", None)
    is_market_exec = (trade_ex_mode == getattr(mt5, "SYMBOL_TRADE_EXECUTION_MARKET", 2))

    # Priority filling modes to test
    filling_mode = getattr(info, "filling_mode", 0) if info else 0
    candidate_fillings = []
    if filling_mode & 2:
        candidate_fillings.append(getattr(mt5, "ORDER_FILLING_IOC", 1))
    if filling_mode & 1:
        candidate_fillings.append(getattr(mt5, "ORDER_FILLING_FOK", 0))
    if hasattr(mt5, "ORDER_FILLING_RETURN"):
        candidate_fillings.append(getattr(mt5, "ORDER_FILLING_RETURN", 2))
    for f in (getattr(mt5, "ORDER_FILLING_IOC", 1), getattr(mt5, "ORDER_FILLING_RETURN", 2), getattr(mt5, "ORDER_FILLING_FOK", 0)):
        if f not in candidate_fillings:
            candidate_fillings.append(f)

    # Comments to test
    clean_rationale = re.sub(r'[^a-zA-Z0-9]', '', str(payload.rationale or "")).strip()
    order_comment = f"SMC_{clean_rationale[:8]}" if clean_rationale else "SMC"
    candidate_comments = [order_comment, ""]

    # Stops to try on initial entry
    # If broker uses Market Execution (mode 2), start immediately with sl=0, tp=0
    if is_market_exec:
        candidate_stops = [(0.0, 0.0)]
    else:
        candidate_stops = [(desired_sl, desired_tp), (0.0, 0.0)]

    accepted_ret_codes = (
        getattr(mt5, "TRADE_RETCODE_DONE", 10009),
        getattr(mt5, "TRADE_RETCODE_PLACED", 10008),
        getattr(mt5, "TRADE_RETCODE_DONE_PARTIAL", 10010),
    )

    magic_num = payload.magic or {
        "EURUSD": 10001,
        "USDJPY": 10002,
        "GBPUSD": 10003,
        "XAUUSD": 20261001,
    }.get(symbol.upper(), 20261001)

    result = None
    applied_sl_tp_afterwards = False

    logger.info(f"⚡ [MT5 Order] Sending {payload.direction} {payload.volume}L on {symbol} (MarketExec={is_market_exec}, Desired SL={desired_sl}, TP={desired_tp})...")

    # Execution matrix: iterate combinations until MT5 accepts
    for sl_val, tp_val in candidate_stops:
        for cmt in candidate_comments:
            for fill in candidate_fillings:
                # Refresh tick for accurate live price on each pass
                cur_tick = mt5.symbol_info_tick(symbol)
                cur_price = (cur_tick.ask if payload.direction == "BUY" else cur_tick.bid) if cur_tick else price

                request_data = {
                    "action": mt5.TRADE_ACTION_DEAL,
                    "symbol": symbol,
                    "volume": payload.volume,
                    "type": order_type,
                    "price": cur_price,
                    "sl": sl_val,
                    "tp": tp_val,
                    "deviation": 300,  # 300 points slippage tolerance for fast broker fills
                    "magic": magic_num,
                    "type_time": mt5.ORDER_TIME_GTC,
                    "type_filling": fill,
                }
                if cmt:
                    request_data["comment"] = cmt

                result = mt5.order_send(request_data)
                ret_code = getattr(result, "retcode", None)
                ret_cmt = getattr(result, "comment", "")

                if result is not None and result.retcode in accepted_ret_codes:
                    logger.info(f"✅ [MT5 Order Success] Filled: ticket={result.order or result.deal}, retcode={result.retcode}, filling={fill}, stops=({sl_val},{tp_val})")
                    if sl_val == 0.0 and (desired_sl > 0 or desired_tp > 0):
                        applied_sl_tp_afterwards = True
                    break
                else:
                    # If AlgoTrading is disabled, don't waste time trying all combinations - break early
                    if ret_code in (getattr(mt5, "TRADE_RETCODE_CLIENT_DISABLES_AT", 10027), getattr(mt5, "TRADE_RETCODE_AUTOTRADING_DISABLED", 10026)) or "autotrading" in str(ret_cmt).lower():
                        logger.error(f"❌ MT5 Algo Trading is disabled in terminal: retcode={ret_code} ({ret_cmt})")
                        break
                    logger.warning(f"MT5 order attempt failed: retcode={ret_code} ({ret_cmt}), fill={fill}, cmt={cmt!r}, sl/tp=({sl_val},{tp_val})")
            
            if result is not None and result.retcode in accepted_ret_codes:
                break
            if result is not None and getattr(result, "retcode", None) in (getattr(mt5, "TRADE_RETCODE_CLIENT_DISABLES_AT", 10027), getattr(mt5, "TRADE_RETCODE_AUTOTRADING_DISABLED", 10026)):
                break
        if result is not None and result.retcode in accepted_ret_codes:
            break
        if result is not None and getattr(result, "retcode", None) in (getattr(mt5, "TRADE_RETCODE_CLIENT_DISABLES_AT", 10027), getattr(mt5, "TRADE_RETCODE_AUTOTRADING_DISABLED", 10026)):
            break

    if result is None or result.retcode not in accepted_ret_codes:
        retcode = getattr(result, "retcode", None)
        comment = getattr(result, "comment", "")
        last_err = mt5.last_error()
        logger.error("=" * 65)
        logger.error(f"❌ MT5 Order Placement Failed on {symbol}:")
        logger.error(f"   Retcode: {retcode}")
        logger.error(f"   Comment: {comment}")
        logger.error(f"   Last Error: {last_err}")

        if retcode in (getattr(mt5, "TRADE_RETCODE_CLIENT_DISABLES_AT", 10027), getattr(mt5, "TRADE_RETCODE_AUTOTRADING_DISABLED", 10026)) or "autotrading" in str(comment).lower():
            logger.error("👉 FIX: Enable 'Algo Trading' in your MetaTrader 5 terminal!")
            logger.error("👉 Click the 'Algo Trading' button in MT5 toolbar, or press Ctrl+E")
            logger.error("=" * 65)
            raise HTTPException(
                status_code=400,
                detail="MT5 AutoTrading is disabled in terminal. Click the 'Algo Trading' button in MT5 toolbar (or Ctrl+E)."
            )

        if retcode == getattr(mt5, "TRADE_RETCODE_MARKET_CLOSED", 10018) or "closed" in str(comment).lower():
            logger.error(f"👉 Market for {symbol} is currently closed.")
            logger.error("=" * 65)
            raise HTTPException(status_code=400, detail=f"Market for {symbol} is currently closed.")

        if retcode == getattr(mt5, "TRADE_RETCODE_NO_MONEY", 10019) or "money" in str(comment).lower():
            logger.error(f"👉 Insufficient margin to open {payload.volume}L on {symbol}.")
            logger.error("=" * 65)
            raise HTTPException(status_code=400, detail=f"Insufficient free margin to open {payload.volume}L on {symbol}.")

        logger.error("=" * 65)
        raise HTTPException(
            status_code=400,
            detail=f"MT5 broker rejected order ({retcode}): {comment or last_err or 'Check broker symbol specifications'}"
        )

    snapshot = read_snapshot(symbol)
    position_ticket = int(result.order or result.deal)
    if result.deal:
        deal_matches = mt5.history_deals_get(ticket=int(result.deal))
        if deal_matches:
            position_ticket = int(deal_matches[0].position_id)

    # If order was filled with sl=0, tp=0, attach protective stops now
    if applied_sl_tp_afterwards and position_ticket and (desired_sl > 0 or desired_tp > 0):
        try:
            sltp_req = {
                "action": mt5.TRADE_ACTION_SLTP,
                "symbol": symbol,
                "position": position_ticket,
                "sl": desired_sl,
                "tp": desired_tp,
            }
            sltp_res = mt5.order_send(sltp_req)
            if sltp_res is not None and sltp_res.retcode in accepted_ret_codes:
                logger.info(f"🛡️ [MT5 Stops Attached] Position #{position_ticket} SL={desired_sl}, TP={desired_tp}")
            else:
                logger.warning(f"Could not attach initial SL/TP to #{position_ticket}: {getattr(sltp_res, 'comment', 'N/A')}")
        except Exception as exc:
            logger.warning(f"Error attaching initial SL/TP to #{position_ticket}: {exc}")

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
                payload.volume, desired_sl, desired_tp, response_ticket, position_ticket,
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
    filling = resolve_filling_mode(info)
    close_data = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": position.symbol,
        "volume": float(position.volume),
        "type": mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY,
        "position": int(position.ticket),
        "price": float(tick.bid if is_buy else tick.ask),
        "deviation": 20,
        "magic": int(position.magic),
        "comment": "SMC_CLOSE",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": filling,
    }
    result = mt5.order_send(close_data)
    accepted_close_codes = (
        mt5.TRADE_RETCODE_DONE,
        mt5.TRADE_RETCODE_PLACED,
        mt5.TRADE_RETCODE_DONE_PARTIAL,
    )
    if result is not None and result.retcode not in accepted_close_codes:
        comment_code = getattr(mt5, "TRADE_RETCODE_INVALID_COMMENT", 10015)
        res_comment = str(getattr(result, "comment", "")).lower()
        if result.retcode == comment_code or "comment" in res_comment:
            logger.warning("MT5 rejected close comment; retrying with comment field omitted")
            close_data.pop("comment", None)
            alt_res = mt5.order_send(close_data)
            if alt_res is not None:
                result = alt_res
    if result is not None and result.retcode not in accepted_close_codes:
        invalid_fill_code = getattr(mt5, "TRADE_RETCODE_INVALID_FILL", 10030)
        if result.retcode == invalid_fill_code or "filling" in str(getattr(result, "comment", "")).lower():
            alt_fillings = [
                getattr(mt5, "ORDER_FILLING_FOK", 0),
                getattr(mt5, "ORDER_FILLING_IOC", 1),
                getattr(mt5, "ORDER_FILLING_RETURN", 2),
            ]
            for alt_filling in alt_fillings:
                if alt_filling == filling:
                    continue
                close_data["type_filling"] = alt_filling
                alt_result = mt5.order_send(close_data)
                if alt_result is not None and alt_result.retcode in accepted_close_codes:
                    result = alt_result
                    break
    if result is None or result.retcode not in (
        mt5.TRADE_RETCODE_DONE,
        mt5.TRADE_RETCODE_PLACED,
        mt5.TRADE_RETCODE_DONE_PARTIAL,
    ):
        reason = f"{result.retcode}: {result.comment}" if result else str(mt5.last_error())
        logger.error(f"❌ MT5 Close Request Failed for position {payload.ticket}: {reason}")
        raise HTTPException(status_code=400, detail=f"MT5 close request failed: {reason}")
    logger.info(f"✅ MT5 Closed position #{payload.ticket} successfully")
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
    digits = int(getattr(info, "digits", 2))
    tick_size = spec.get("tickSize", 0.01) or 0.01
    min_dist = max(min_stop_distance, freeze_distance, tick_size * 3)

    if payload.sl > 0:
        payload.sl = round(round(payload.sl / tick_size) * tick_size, digits)
        if is_buy and payload.sl >= market_price - min_dist:
            payload.sl = round(market_price - min_dist * 1.5, digits)
        elif not is_buy and payload.sl <= market_price + min_dist:
            payload.sl = round(market_price + min_dist * 1.5, digits)

    if payload.tp > 0:
        payload.tp = round(round(payload.tp / tick_size) * tick_size, digits)
        if is_buy and payload.tp <= market_price + min_dist:
            payload.tp = round(market_price + min_dist * 2.0, digits)
        elif not is_buy and payload.tp >= market_price - min_dist:
            payload.tp = round(market_price - min_dist * 2.0, digits)
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
        logger.error(f"❌ MT5 Stop Update Failed for position #{payload.ticket}: {reason}")
        raise HTTPException(status_code=400, detail=f"MT5 stop update failed: {reason}")
    logger.info(f"🛡️ MT5 Stop Update OK for position #{payload.ticket}: SL={payload.sl}, TP={payload.tp}")
    return read_snapshot(position.symbol)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)

"""Local-only FastAPI bridge for a MetaTrader 5 terminal on Windows."""

from __future__ import annotations

import math
import os
import hmac
from datetime import datetime, timedelta, timezone
from typing import Literal

import MetaTrader5 as mt5
from fastapi import FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, Field

app = FastAPI(title="Local MT5 Bridge", docs_url=None, redoc_url=None)


class ConnectRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)


class TradeRequest(BaseModel):
    direction: Literal["BUY", "SELL"]
    volume: float = Field(gt=0, le=100)
    symbol: str = Field(min_length=1, max_length=32)
    sl: float
    tp: float
    rationale: str = Field(default="", max_length=1000)


class CloseRequest(BaseModel):
    ticket: int = Field(gt=0)


class StopsRequest(BaseModel):
    ticket: int = Field(gt=0)
    sl: float = Field(ge=0)
    tp: float = Field(ge=0)


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
    }


def read_positions() -> list[dict]:
    positions = mt5.positions_get()
    if positions is None:
        raise HTTPException(status_code=503, detail=f"MT5 positions unavailable: {mt5.last_error()}")
    return [
        {
            "ticket": int(position.ticket),
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
    if info.point <= 0 or tick.bid <= 0 or tick.ask <= 0:
        raise HTTPException(status_code=503, detail=f"MT5 returned an invalid quote for {symbol!r}.")

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
        "bid": float(tick.bid),
        "ask": float(tick.ask),
        "spread": round((tick.ask - tick.bid) / info.point),
        "candlesM15": candles(mt5.TIMEFRAME_M15),
        "candlesH1": candles(mt5.TIMEFRAME_H1),
    }


def _deal_time(deal: object) -> datetime:
    return datetime.fromtimestamp(int(deal.time), timezone.utc)


def _deal_cost(deal: object) -> float:
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
    deals_by_position: dict[int, list[object]] = {}
    for deal in deals:
        if str(deal.symbol) == symbol:
            deals_by_position.setdefault(int(deal.position_id), []).append(deal)

    exits_by_position: dict[int, list[object]] = {}
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


@app.get("/api/history")
def history(
    request: Request,
    days: int = Query(default=180, ge=1, le=365),
    symbol: str = Query(default="XAUUSD", min_length=1, max_length=32),
) -> list[dict]:
    require_bridge_token(request)
    return read_closed_trades(days, symbol.strip())


@app.post("/api/trade")
def place_trade(payload: TradeRequest, request: Request) -> dict:
    require_bridge_token(request)
    require_account()

    symbol = payload.symbol.strip()
    if not mt5.symbol_select(symbol, True):
        raise HTTPException(status_code=400, detail=f"MT5 could not select symbol {symbol!r}.")

    info = mt5.symbol_info(symbol)
    tick = mt5.symbol_info_tick(symbol)
    if info is None or tick is None:
        raise HTTPException(status_code=503, detail=f"No current MT5 quote for {symbol!r}.")
    if not all(math.isfinite(value) for value in (payload.volume, payload.sl, payload.tp)):
        raise HTTPException(status_code=400, detail="Volume and protective levels must be finite numbers.")
    if payload.volume < info.volume_min or payload.volume > info.volume_max:
        raise HTTPException(
            status_code=400,
            detail=f"Volume must be between {info.volume_min} and {info.volume_max} lots for {symbol}.",
        )
    step_count = round((payload.volume - info.volume_min) / info.volume_step)
    if abs(info.volume_min + step_count * info.volume_step - payload.volume) > 1e-8:
        raise HTTPException(status_code=400, detail=f"Volume must use {info.volume_step} lot increments.")

    order_type = mt5.ORDER_TYPE_BUY if payload.direction == "BUY" else mt5.ORDER_TYPE_SELL
    price = tick.ask if payload.direction == "BUY" else tick.bid
    if payload.direction == "BUY" and not (payload.sl < price < payload.tp):
        raise HTTPException(status_code=400, detail="For a BUY, require stop loss < current ask < take profit.")
    if payload.direction == "SELL" and not (payload.tp < price < payload.sl):
        raise HTTPException(status_code=400, detail="For a SELL, require take profit < current bid < stop loss.")

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
        "magic": 20261001,
        "comment": f"SMC: {rationale_comment}" if rationale_comment else "SMC dashboard",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": filling,
    }
    result = mt5.order_send(request_data)
    if result is None:
        raise HTTPException(status_code=502, detail=f"MT5 order request failed: {mt5.last_error()}")
    if result.retcode not in (mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED):
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

    return {
        "ok": True,
        "ticket": int(result.order or result.deal),
        "positionTicket": position_ticket,
        "price": float(result.price or price),
        **snapshot,
    }


@app.post("/api/close")
def close_position(payload: CloseRequest, request: Request) -> dict:
    require_bridge_token(request)
    require_account()
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
    if result is None or result.retcode not in (mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED):
        reason = f"{result.retcode}: {result.comment}" if result else str(mt5.last_error())
        raise HTTPException(status_code=502, detail=f"MT5 close request failed: {reason}")
    return read_snapshot(position.symbol)


@app.post("/api/modify")
def modify_position(payload: StopsRequest, request: Request) -> dict:
    require_bridge_token(request)
    require_account()
    matches = mt5.positions_get(ticket=payload.ticket)
    if not matches:
        raise HTTPException(status_code=404, detail=f"Open MT5 position {payload.ticket} was not found.")
    position = matches[0]
    tick = mt5.symbol_info_tick(position.symbol)
    if tick is None:
        raise HTTPException(status_code=503, detail=f"No current MT5 quote for {position.symbol!r}.")
    is_buy = position.type == mt5.POSITION_TYPE_BUY
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

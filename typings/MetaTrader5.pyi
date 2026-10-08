from typing import Any, Sequence

ACCOUNT_TRADE_MODE_DEMO: int
ACCOUNT_TRADE_MODE_REAL: int
ACCOUNT_TRADE_MODE_CONTEST: int

POSITION_TYPE_BUY: int
POSITION_TYPE_SELL: int

DEAL_TYPE_BUY: int
DEAL_TYPE_SELL: int
DEAL_REASON_TP: int
DEAL_REASON_SL: int
DEAL_ENTRY_IN: int
DEAL_ENTRY_OUT: int
DEAL_ENTRY_OUT_BY: int
DEAL_ENTRY_INOUT: int

TIMEFRAME_M1: int
TIMEFRAME_M5: int
TIMEFRAME_M15: int
TIMEFRAME_H1: int

ORDER_TYPE_BUY: int
ORDER_TYPE_SELL: int
ORDER_FILLING_IOC: int
ORDER_FILLING_FOK: int
ORDER_FILLING_RETURN: int
ORDER_TIME_GTC: int
TRADE_ACTION_DEAL: int
TRADE_ACTION_SLTP: int
SYMBOL_FILLING_IOC: int
SYMBOL_FILLING_FOK: int
TRADE_RETCODE_DONE: int
TRADE_RETCODE_PLACED: int
TRADE_RETCODE_DONE_PARTIAL: int

class Position:
    ticket: int
    type: int
    volume: float
    price_open: float
    sl: float
    tp: float
    profit: float
    magic: int
    comment: str
    time: int
    symbol: str

class SymbolInfo:
    point: float
    trade_tick_size: float
    trade_tick_value: float
    trade_contract_size: float
    volume_min: float
    volume_max: float
    volume_step: float
    trade_stops_level: int
    trade_freeze_level: int
    filling_mode: int

class TimeTick:
    bid: float
    ask: float

class Deal:
    time: int
    symbol: str
    position_id: int
    entry: int
    price: float
    volume: float
    profit: float
    swap: float
    commission: float
    fee: float
    reason: int
    comment: str
    order: int
    ticket: int
    type: int

class OrderResult:
    retcode: int
    comment: str
    deal: int
    order: int
    price: float
    volume: float


def initialize() -> bool: ...
def terminal_info() -> Any | None: ...
def account_info() -> Any | None: ...
def last_error() -> str: ...
def symbol_select(symbol: str, enable: bool) -> bool: ...
def symbol_info(symbol: str) -> SymbolInfo | None: ...
def symbol_info_tick(symbol: str) -> TimeTick | None: ...
def positions_get(*, ticket: int | None = None, symbol: str | None = None) -> list[Position] | None: ...
def copy_rates_from_pos(symbol: str, timeframe: int, start: int, count: int) -> Sequence[dict[str, Any]] | None: ...
def history_deals_get(start: Any | None = None, end: Any | None = None, *, ticket: int | None = None, position: int | None = None) -> list[Deal] | None: ...
def order_send(request: dict[str, Any]) -> OrderResult | None: ...

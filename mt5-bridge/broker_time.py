from __future__ import annotations

from math import isfinite

MAX_BROKER_CLOCK_OFFSET_SECONDS = 14 * 60 * 60
MIN_BROKER_CLOCK_OFFSET_SECONDS = 5 * 60


def future_broker_clock_offset_seconds(
    broker_time_seconds: float,
    now_seconds: float,
) -> int:
    if not isfinite(broker_time_seconds) or not isfinite(now_seconds):
        return 0

    offset_seconds = broker_time_seconds - now_seconds
    if not MIN_BROKER_CLOCK_OFFSET_SECONDS < offset_seconds <= MAX_BROKER_CLOCK_OFFSET_SECONDS:
        return 0

    return round(offset_seconds / 60) * 60

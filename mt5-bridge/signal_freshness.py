from datetime import datetime, timedelta


_SIGNAL_MAX_AGE_SECONDS = {
    "M1": 60 + 90,
    "M5": 5 * 60 + 5 * 60,
    "M15": 15 * 60 + 15 * 60,
}


def signal_max_age(timeframe: str) -> timedelta:
    return timedelta(seconds=_SIGNAL_MAX_AGE_SECONDS[timeframe])


def is_signal_stale(signal_bar_time: datetime, now: datetime, timeframe: str) -> bool:
    return now - signal_bar_time > signal_max_age(timeframe)

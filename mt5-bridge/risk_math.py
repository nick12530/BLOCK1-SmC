import math


def is_valid_close_volume(
    requested_volume: float,
    position_volume: float,
    volume_min: float,
    volume_step: float,
) -> bool:
    values = (requested_volume, position_volume, volume_min, volume_step)
    if (
        not all(math.isfinite(value) for value in values)
        or requested_volume <= 0
        or position_volume <= 0
        or volume_min <= 0
        or volume_step <= 0
    ):
        return False

    tolerance = max(1e-8, volume_step * 1e-6)
    volume_units = round(requested_volume / volume_step)
    remaining_volume = position_volume - requested_volume
    return (
        requested_volume >= volume_min - tolerance
        and requested_volume <= position_volume + tolerance
        and abs(requested_volume - volume_units * volume_step) <= tolerance
        and not (
            remaining_volume > tolerance
            and remaining_volume < volume_min - tolerance
        )
    )


def stop_risk(
    direction: str,
    volume: float,
    entry: float,
    stop_loss: float,
    tick_size: float,
    tick_value: float,
) -> float | None:
    values = (volume, entry, stop_loss, tick_size, tick_value)
    if (
        direction not in {"BUY", "SELL"}
        or not all(math.isfinite(value) for value in values)
        or volume < 0
        or tick_size <= 0
        or tick_value <= 0
        or stop_loss <= 0
    ):
        return None
    adverse_distance = entry - stop_loss if direction == "BUY" else stop_loss - entry
    return max(0.0, adverse_distance) / tick_size * tick_value * volume


def volume_for_risk(
    risk_budget: float,
    risk_per_lot: float,
    volume_min: float,
    volume_step: float,
    volume_max: float,
) -> float | None:
    values = (risk_budget, risk_per_lot, volume_min, volume_step, volume_max)
    if (
        not all(math.isfinite(value) for value in values)
        or risk_budget <= 0
        or risk_per_lot <= 0
        or volume_min <= 0
        or volume_step <= 0
        or volume_max < volume_min
    ):
        return None

    raw_volume = risk_budget / risk_per_lot
    if raw_volume + 1e-9 < volume_min:
        return None
    step_count = math.floor((min(raw_volume, volume_max) - volume_min) / volume_step + 1e-9)
    precision = min(8, len(f"{volume_step:.8f}".rstrip("0").split(".")[-1]))
    volume = round(volume_min + max(0, step_count) * volume_step, precision)
    return volume if volume_min <= volume <= volume_max else None

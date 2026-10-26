from __future__ import annotations

from datetime import datetime, timezone
from math import floor
from typing import Any


COUNTRY_CURRENCIES = {
    "US": "USD",
    "UNITED STATES": "USD",
    "EU": "EUR",
    "EUROPEAN UNION": "EUR",
    "EURO ZONE": "EUR",
    "EUROZONE": "EUR",
    "GB": "GBP",
    "UK": "GBP",
    "UNITED KINGDOM": "GBP",
    "JP": "JPY",
    "JAPAN": "JPY",
}

IMPACT_LEVELS = {
    "1": "low",
    "LOW": "low",
    "2": "medium",
    "MEDIUM": "medium",
    "3": "high",
    "HIGH": "high",
}


def normalize_finnhub_calendar(
    records: list[dict[str, Any]],
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    current = current.astimezone(timezone.utc)
    events: list[dict[str, Any]] = []

    for record in records:
        if not isinstance(record, dict):
            continue
        country = str(record.get("country", "")).strip().upper()
        currency = COUNTRY_CURRENCIES.get(country)
        impact = IMPACT_LEVELS.get(str(record.get("impact", "")).strip().upper())
        event_name = str(record.get("event", "")).strip()
        raw_time = record.get("time")
        if not currency or not impact or not event_name or not isinstance(raw_time, str):
            continue

        try:
            event_time = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
        except ValueError:
            continue
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)
        event_time = event_time.astimezone(timezone.utc)
        seconds_remaining = (event_time - current).total_seconds()
        if seconds_remaining < 0 or seconds_remaining > 7 * 24 * 60 * 60:
            continue

        country_code = country[:3]
        events.append(
            {
                "id": f"{country_code}:{event_name}:{event_time.isoformat()}",
                "time": event_time.isoformat(),
                "currency": currency,
                "event": event_name,
                "impact": impact,
                "forecast": str(record.get("estimate") or "—"),
                "previous": str(record.get("prev") or "—"),
                "minutesRemaining": floor(seconds_remaining / 60),
            }
        )

    events.sort(key=lambda event: event["time"])
    return events


def normalize_forexfactory_calendar(
    records: list[dict[str, Any]],
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    currency_countries = {
        "USD": "US",
        "EUR": "EU",
        "GBP": "GB",
        "JPY": "JP",
    }
    normalized_records: list[dict[str, Any]] = []

    for record in records:
        if not isinstance(record, dict):
            continue
        country = str(record.get("country", "")).strip().upper()
        impact = str(record.get("impact", "")).strip().lower()
        if country not in currency_countries or impact not in {"low", "medium", "high"}:
            continue
        normalized_records.append(
            {
                "country": currency_countries[country],
                "impact": impact,
                "event": record.get("title"),
                "time": record.get("date"),
                "estimate": record.get("forecast"),
                "prev": record.get("previous"),
            }
        )

    return normalize_finnhub_calendar(normalized_records, now)

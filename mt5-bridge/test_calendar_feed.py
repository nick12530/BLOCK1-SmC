import unittest
from datetime import datetime, timezone

from calendar_feed import normalize_finnhub_calendar, normalize_forexfactory_calendar


class FinnhubCalendarNormalizationTests(unittest.TestCase):
    def test_maps_currencies_impacts_and_minutes_until_events(self):
        now = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)
        records = [
            {
                "country": "US",
                "impact": "3",
                "event": "CPI",
                "time": "2026-10-21T12:15:00Z",
                "estimate": 2.1,
                "prev": 2.0,
            },
            {
                "country": "GB",
                "impact": "High",
                "event": "Rate decision",
                "time": "2026-10-21T13:00:00+00:00",
            },
        ]

        events = normalize_finnhub_calendar(records, now)

        self.assertEqual([event["currency"] for event in events], ["USD", "GBP"])
        self.assertEqual([event["impact"] for event in events], ["high", "high"])
        self.assertEqual([event["minutesRemaining"] for event in events], [15, 60])
        self.assertEqual(events[0]["forecast"], "2.1")

    def test_excludes_unsupported_currencies_past_events_and_invalid_records(self):
        now = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)
        records = [
            {"country": "CA", "impact": "3", "event": "CPI", "time": "2026-10-21T13:00:00Z"},
            {"country": "US", "impact": "3", "event": "Past", "time": "2026-10-21T11:00:00Z"},
            {"country": "US", "impact": "unknown", "event": "Bad impact", "time": "2026-10-21T13:00:00Z"},
            {"country": "US", "impact": "3", "event": "Bad time", "time": "not-a-date"},
        ]

        self.assertEqual(normalize_finnhub_calendar(records, now), [])

    def test_excludes_events_beyond_the_seven_day_fetch_window(self):
        now = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)
        records = [
            {
                "country": "US",
                "impact": "3",
                "event": "Future",
                "time": "2026-10-29T12:00:00Z",
            }
        ]

        self.assertEqual(normalize_finnhub_calendar(records, now), [])


class ForexFactoryCalendarNormalizationTests(unittest.TestCase):
    def test_maps_supported_currency_events_and_provider_fields(self):
        now = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)
        records = [
            {
                "title": "Consumer Price Index",
                "country": "USD",
                "date": "2026-10-21T12:15:00Z",
                "impact": "High",
                "forecast": "2.1%",
                "previous": "2.0%",
            },
            {
                "title": "Euro Zone CPI",
                "country": "EUR",
                "date": "2026-10-21T17:00:00Z",
                "impact": "Medium",
            },
        ]

        events = normalize_forexfactory_calendar(records, now)

        self.assertEqual([event["currency"] for event in events], ["USD", "EUR"])
        self.assertEqual([event["impact"] for event in events], ["high", "medium"])
        self.assertEqual([event["minutesRemaining"] for event in events], [15, 300])
        self.assertEqual(events[0]["event"], "Consumer Price Index")
        self.assertEqual(events[0]["forecast"], "2.1%")

    def test_excludes_unsupported_currencies_invalid_impact_and_old_events(self):
        now = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)
        records = [
            {"title": "Canada CPI", "country": "CAD", "date": "2026-10-21T13:00:00Z", "impact": "High"},
            {"title": "Holiday", "country": "USD", "date": "2026-10-21T13:00:00Z", "impact": "Holiday"},
            {"title": "Past event", "country": "GBP", "date": "2026-10-21T11:00:00Z", "impact": "High"},
        ]

        self.assertEqual(normalize_forexfactory_calendar(records, now), [])


if __name__ == "__main__":
    unittest.main()

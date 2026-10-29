import unittest
from datetime import datetime, timedelta, timezone

from signal_freshness import is_signal_stale, signal_max_age


class SignalFreshnessTests(unittest.TestCase):
    def test_age_limit_includes_candle_duration_and_entry_window(self):
        self.assertEqual(signal_max_age("M1"), timedelta(seconds=150))
        self.assertEqual(signal_max_age("M5"), timedelta(minutes=10))
        self.assertEqual(signal_max_age("M15"), timedelta(minutes=30))

    def test_closed_candle_signal_remains_fresh_during_entry_window(self):
        now = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)
        for timeframe in ("M1", "M5", "M15"):
            with self.subTest(timeframe=timeframe):
                candle_open = now - signal_max_age(timeframe) + timedelta(seconds=1)
                self.assertFalse(is_signal_stale(candle_open, now, timeframe))

    def test_signal_older_than_entry_window_is_stale(self):
        now = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)
        for timeframe in ("M1", "M5", "M15"):
            with self.subTest(timeframe=timeframe):
                candle_open = now - signal_max_age(timeframe) - timedelta(seconds=1)
                self.assertTrue(is_signal_stale(candle_open, now, timeframe))

    def test_signal_at_age_limit_is_still_valid(self):
        now = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)
        candle_open = now - signal_max_age("M5")
        self.assertFalse(is_signal_stale(candle_open, now, "M5"))


if __name__ == "__main__":
    unittest.main()

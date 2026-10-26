import unittest

from broker_time import future_broker_clock_offset_seconds


class BrokerClockOffsetTests(unittest.TestCase):
    def test_detects_and_rounds_a_three_hour_server_clock_offset(self):
        self.assertEqual(
            future_broker_clock_offset_seconds(110_804, 100_004),
            10_800,
        )

    def test_ignores_small_future_differences(self):
        self.assertEqual(future_broker_clock_offset_seconds(100_200, 100_000), 0)

    def test_does_not_shift_stale_broker_times(self):
        self.assertEqual(future_broker_clock_offset_seconds(90_000, 100_000), 0)

    def test_ignores_unreasonable_future_offsets(self):
        self.assertEqual(
            future_broker_clock_offset_seconds(100_000 + 15 * 60 * 60, 100_000),
            0,
        )

    def test_ignores_non_finite_timestamps(self):
        self.assertEqual(future_broker_clock_offset_seconds(float("nan"), 100_000), 0)


if __name__ == "__main__":
    unittest.main()

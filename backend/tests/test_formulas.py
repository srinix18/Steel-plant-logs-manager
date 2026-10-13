from app.utils.formulas import evaluate_formula


def test_duration_with_mixed_timezone_inputs():
    types = {"tap_end": "datetime", "tap_start": "datetime"}
    # One time carries an offset, the other was typed without one: must not raise.
    values = {"tap_end": "2026-10-13T10:00:00", "tap_start": "2026-10-13T08:15:00+05:30"}
    assert evaluate_formula("tap_end - tap_start", values, types) == "1h 45m"
    values = {"tap_end": "2026-10-13T04:30:00Z", "tap_start": "2026-10-13T09:00:00"}
    assert evaluate_formula("tap_end - tap_start", values, types) == "1h 0m"

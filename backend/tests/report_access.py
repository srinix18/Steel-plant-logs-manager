"""Not a test: `pytest tests/report_access.py -s` prints which roles get data from each GET."""
import json
import pytest
from tests.helpers import ACCOUNTS
from tests.test_smoke_matrix import GET_ROUTES, _fill, ids  # noqa: F401

REPS = ["admin", "ceo", "hr", "hod_sms", "sup_iaf", "worker_sms", "maint_equipment", "worker_rolling"]


async def test_print_access_matrix(api, ids):
    for route in GET_ROUTES:
        row = []
        for who in REPS:
            path = _fill(route, api.user(who), ids)
            if path is None:
                break
            r = await api.get(who, path)
            size = ""
            if r.status_code == 200:
                try:
                    body = r.json()
                    size = str(len(body)) if isinstance(body, list) else "obj"
                except Exception:
                    size = "file"
            row.append(f"{who}={r.status_code}{':' + size if size else ''}")
        if row:
            print("ACCESS", route, " ".join(row))

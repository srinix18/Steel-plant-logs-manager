from __future__ import annotations

from io import BytesIO
from typing import Any

from openpyxl import Workbook, load_workbook


def build_template(columns: list[str]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Import"
    for idx, col in enumerate(columns, start=1):
        ws.cell(row=1, column=idx, value=col)
    # Row 2: hint for department_id column
    if "department_id" in columns:
        col_idx = columns.index("department_id") + 1
        ws.cell(row=2, column=col_idx, value="SMS (code or UUID)")
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def parse_xlsx(content: bytes) -> list[dict[str, Any]]:
    wb = load_workbook(BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    header_row = next(rows_iter, None)
    if not header_row:
        return []
    headers = [str(h).strip() if h is not None else "" for h in header_row]
    result: list[dict[str, Any]] = []
    for row in rows_iter:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue
        item: dict[str, Any] = {}
        for i, key in enumerate(headers):
            if not key:
                continue
            val = row[i] if i < len(row) else None
            item[key] = "" if val is None else val
        result.append(item)
    return result

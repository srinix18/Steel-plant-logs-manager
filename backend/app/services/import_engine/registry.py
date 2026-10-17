from __future__ import annotations

from typing import Any, Callable, Awaitable

Handler = Callable[..., Awaitable[Any]]

_REGISTRY: dict[str, dict[str, Any]] = {}


def register_module(
    key: str,
    *,
    columns: list[str],
    required: list[str],
    validate_row: Handler,
    import_row: Handler,
    aliases: dict[str, str] | None = None,
    unique_keys: list[str] | None = None,
    build_template: Handler | None = None,
    row_keys: Callable[[dict[str, Any]], dict[str, str]] | None = None,
) -> None:
    """``aliases`` maps alternative header spellings to a column; ``unique_keys`` are columns that may not
    repeat inside one file; ``build_template(session, org_id)`` returns a richer workbook than bare headers."""
    _REGISTRY[key] = {
        "columns": columns,
        "required": required,
        "validate_row": validate_row,
        "import_row": import_row,
        "aliases": aliases or {},
        "unique_keys": unique_keys or [],
        "build_template": build_template,
        "row_keys": row_keys,
    }


def get_module(key: str) -> dict[str, Any]:
    if key not in _REGISTRY:
        raise KeyError(f"Import module not registered: {key}")
    return _REGISTRY[key]


def list_modules() -> list[str]:
    return list(_REGISTRY.keys())

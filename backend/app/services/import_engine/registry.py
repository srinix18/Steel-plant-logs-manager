from __future__ import annotations

from typing import Any, Callable, Awaitable

Handler = Callable[..., Awaitable[dict[str, Any]]]

_REGISTRY: dict[str, dict[str, Any]] = {}


def register_module(
    key: str,
    *,
    columns: list[str],
    required: list[str],
    validate_row: Handler,
    import_row: Handler,
) -> None:
    _REGISTRY[key] = {
        "columns": columns,
        "required": required,
        "validate_row": validate_row,
        "import_row": import_row,
    }


def get_module(key: str) -> dict[str, Any]:
    if key not in _REGISTRY:
        raise KeyError(f"Import module not registered: {key}")
    return _REGISTRY[key]


def list_modules() -> list[str]:
    return list(_REGISTRY.keys())

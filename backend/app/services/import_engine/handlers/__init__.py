"""Import module handlers — register on bootstrap."""

from app.services.import_engine.handlers import employees  # noqa: F401

__all__ = ["employees"]

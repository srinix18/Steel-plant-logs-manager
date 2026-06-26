"""Register all import handlers on application startup."""


def bootstrap_import_handlers() -> None:
    import app.services.import_engine.handlers  # noqa: F401

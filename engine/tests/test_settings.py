import importlib

import pytest

import app.settings as settings_module


def test_unimplemented_contextual_mode_raises_at_import(monkeypatch):
    """CONTEXTUAL_MODE=llm is documented but unimplemented; it used to silently
    behave as 'header'. Importing app.settings with it set must now fail loudly
    instead of degrading in silence. `app.settings` is imported by nearly
    everything, so this raise happens at module import time — reload it under
    the bad env inside pytest.raises.

    `importlib.reload` rebinds the module-level `settings` name to a brand-new
    `Settings()` instance; modules that already did `from ..settings import
    settings` (e.g. `app/telegram/crypto.py`) keep their own reference to the
    *original* instance and never see the reload. So cleanup must restore the
    exact original object — not just reload again to a fresh, merely-valid one
    — or those modules silently desync from `app.settings.settings` for the
    rest of the session (this was caught by `test_tg_crypto.py` failing)."""
    original = settings_module.settings
    monkeypatch.setenv("CONTEXTUAL_MODE", "llm")
    try:
        with pytest.raises(ValueError, match="CONTEXTUAL_MODE"):
            importlib.reload(settings_module)
    finally:
        monkeypatch.delenv("CONTEXTUAL_MODE", raising=False)
        settings_module.settings = original


def test_default_and_off_contextual_modes_do_not_raise(monkeypatch):
    original = settings_module.settings
    try:
        for mode in ("off", "header"):
            monkeypatch.setenv("CONTEXTUAL_MODE", mode)
            importlib.reload(settings_module)  # must not raise
    finally:
        monkeypatch.delenv("CONTEXTUAL_MODE", raising=False)
        settings_module.settings = original

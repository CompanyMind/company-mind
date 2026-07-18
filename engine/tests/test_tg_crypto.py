import pytest
from cryptography.fernet import Fernet


@pytest.fixture(autouse=True)
def _key(monkeypatch):
    from app import settings as s

    monkeypatch.setattr(s.settings, "telegram_enc_key", Fernet.generate_key().decode())


def test_encrypt_roundtrip():
    from app.telegram.crypto import encrypt, decrypt

    token = "123456:ABC-DEF_ghiJKL"
    enc = encrypt(token)
    assert enc != token
    assert decrypt(enc) == token

from cryptography.fernet import Fernet

from ..settings import settings


def _f() -> Fernet:
    return Fernet(settings.telegram_enc_key.encode())


def encrypt(plain: str) -> str:
    return _f().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    return _f().decrypt(token.encode()).decode()

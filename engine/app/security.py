from fastapi import Header, HTTPException

from .settings import settings


def require_secret(x_engine_secret: str = Header(default="")) -> None:
    if not settings.engine_internal_secret or x_engine_secret != settings.engine_internal_secret:
        raise HTTPException(status_code=401, detail="bad engine secret")

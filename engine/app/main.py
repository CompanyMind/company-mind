from fastapi import FastAPI

from .health import db_ok, models_ok

app = FastAPI(title="CompBrain Engine")


@app.get("/health")
def health():
    return {"status": "ok", "db": db_ok(), "models": models_ok()}

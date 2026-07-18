from fastapi import FastAPI, UploadFile, Form, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from .health import db_ok, models_ok, embed_dim_ok
from .settings import settings
from .security import require_secret
from .ingest.store import process_document
from .ask.service import answer_query
from .telegram import api as tg_api, store as tg_store

app = FastAPI(title="CompanyMind Engine")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "db": db_ok(),
        "models": models_ok(),
        "embed_dim": settings.embed_dim,
        "embed_dim_ok": embed_dim_ok(),
    }


@app.post("/ingest", status_code=202, dependencies=[Depends(require_secret)])
async def ingest(
    background: BackgroundTasks,
    file: UploadFile,
    document_id: str = Form(...),
    workspace_id: str = Form(...),
):
    data = await file.read()
    background.add_task(
        process_document,
        document_id,
        workspace_id,
        file.filename or "upload",
        file.content_type or "application/octet-stream",
        data,
    )
    return {"status": "accepted"}


class AskBody(BaseModel):
    workspace_id: str
    question: str
    group_ids: list[str] = []
    all_access: bool = False
    user_id: str | None = None  # the authenticated web principal (for the audit log)


@app.post("/ask", dependencies=[Depends(require_secret)])
def ask(body: AskBody):
    result = answer_query(
        body.workspace_id,
        body.question,
        group_ids=body.group_ids,
        all_access=body.all_access,
        user_id=body.user_id,
    )
    return {
        "answer": result.answer,
        "insufficient": result.insufficient,
        "retrieved_chunk_ids": result.retrieved_chunk_ids,
        "citations": [
            {
                "marker": c.marker,
                "chunk_id": c.chunk_id,
                "document_id": c.document_id,
                "filename": c.filename,
                "page": c.page,
                "snippet": c.snippet,
            }
            for c in result.citations
        ],
    }


class TgConnectBody(BaseModel):
    workspace_id: str
    token: str


@app.post("/telegram/connect", dependencies=[Depends(require_secret)])
def telegram_connect(body: TgConnectBody):
    me = tg_api.get_me(body.token)
    if not me.get("ok"):
        raise HTTPException(status_code=400, detail="invalid bot token")
    username = me["result"].get("username", "bot")
    tg_store.connect_bot(body.workspace_id, body.token, username)
    return {"username": username}


class TgWsBody(BaseModel):
    workspace_id: str


@app.post("/telegram/disconnect", dependencies=[Depends(require_secret)])
def telegram_disconnect(body: TgWsBody):
    tg_store.disconnect_bot(body.workspace_id)
    return {"ok": True}

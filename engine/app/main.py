from fastapi import FastAPI, UploadFile, Form, BackgroundTasks, Depends

from .health import db_ok, models_ok
from .security import require_secret
from .ingest.store import process_document

app = FastAPI(title="CompBrain Engine")


@app.get("/health")
def health():
    return {"status": "ok", "db": db_ok(), "models": models_ok()}


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

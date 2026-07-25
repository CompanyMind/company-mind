from fastapi import FastAPI, UploadFile, Form, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from .health import db_ok, models_ok, embed_dim_ok
from .settings import settings
from .security import require_secret
from .db import get_conn
from .access import resolve_access
from .ingest.store import process_document
from .ask.service import answer_query
from .ask.answer import get_chat_call
from .ask.title import generate_title
from .library.source import get_source
from .library import groups as lib_groups
from .library import documents as lib_documents
from .library import folders as lib_folders
from .library.organize import NothingToOrganize, organize_unfiled
from .library.suggest import suggest_questions
from .telegram import api as tg_api, store as tg_store
from .graph import service as graph_service

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
    workspace_id: str = Form(...),
    filename: str = Form(...),
    mime: str = Form(...),
    storage_key: str = Form(...),
    bytes: int = Form(...),
):
    data = await file.read()
    with get_conn() as conn:
        doc = lib_documents.create_document(conn, workspace_id, filename, mime, bytes, storage_key)
    background.add_task(process_document, doc["id"], workspace_id, filename, mime, data)
    return {"document": doc}


@app.get("/documents", dependencies=[Depends(require_secret)])
def documents_list(workspace_id: str, folder: str = ""):
    with get_conn() as conn:
        return {"documents": lib_documents.list_documents(conn, workspace_id, folder or None)}


@app.get("/folders", dependencies=[Depends(require_secret)])
def folders_list(workspace_id: str):
    with get_conn() as conn:
        return lib_folders.list_folders(conn, workspace_id)


class FolderNameBody(BaseModel):
    workspace_id: str
    name: str


@app.post("/folders", dependencies=[Depends(require_secret)])
def folders_create(body: FolderNameBody):
    with get_conn() as conn:
        f = lib_folders.create_folder(conn, body.workspace_id, body.name)
    if f is None:
        raise HTTPException(status_code=409, detail="a folder with that name already exists")
    return {"folder": f}


@app.patch("/folders/{folder_id}", dependencies=[Depends(require_secret)])
def folders_rename(folder_id: str, body: FolderNameBody):
    with get_conn() as conn:
        res = lib_folders.rename_folder(conn, body.workspace_id, folder_id, body.name)
    if res == "notfound":
        raise HTTPException(status_code=404, detail="not found")
    if res == "conflict":
        raise HTTPException(status_code=409, detail="a folder with that name already exists")
    return {"ok": True}


@app.delete("/folders/{folder_id}", dependencies=[Depends(require_secret)])
def folders_delete(folder_id: str, workspace_id: str):
    with get_conn() as conn:
        ok = lib_folders.delete_folder(conn, workspace_id, folder_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


class OrganizeBody(BaseModel):
    workspace_id: str


@app.post("/folders/organize", dependencies=[Depends(require_secret)])
def folders_organize(body: OrganizeBody):
    with get_conn() as conn:
        try:
            return organize_unfiled(conn, body.workspace_id)
        except NothingToOrganize as e:
            raise HTTPException(status_code=400, detail=str(e)) from e


class DocFolderBody(BaseModel):
    workspace_id: str
    folder_id: str | None = None


@app.put("/documents/{document_id}/folder", dependencies=[Depends(require_secret)])
def document_folder_set(document_id: str, body: DocFolderBody):
    with get_conn() as conn:
        ok = lib_folders.set_document_folder(conn, body.workspace_id, document_id, body.folder_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


class AskBody(BaseModel):
    workspace_id: str
    question: str
    user_id: str | None = None  # authenticated web principal
    role: str = "member"  # engine resolves this principal's access itself


@app.post("/ask", dependencies=[Depends(require_secret)])
def ask(body: AskBody):
    result = answer_query(
        body.workspace_id,
        body.question,
        user_id=body.user_id,
        role=body.role,
    )
    return {
        "answer": result.answer,
        "insufficient": result.insufficient,
        "retrieved_chunk_ids": result.retrieved_chunk_ids,
        "debug": result.debug,
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


class TitleBody(BaseModel):
    text: str


@app.post("/title", dependencies=[Depends(require_secret)])
def title(body: TitleBody):
    return {"title": generate_title(body.text, get_chat_call())}


@app.get("/source/{chunk_id}", dependencies=[Depends(require_secret)])
def source(chunk_id: str, workspace_id: str, user_id: str = "", role: str = "member"):
    with get_conn() as conn:
        group_ids, all_access = resolve_access(conn, workspace_id, user_id, role)
        try:
            src = get_source(conn, workspace_id, chunk_id, group_ids, all_access)
        except Exception:  # noqa: BLE001 — malformed id / lookup failure reads as "not found"
            src = None
    if src is None:
        raise HTTPException(status_code=404, detail="not found")
    return src


@app.get("/suggestions", dependencies=[Depends(require_secret)])
def suggestions(workspace_id: str, user_id: str = "", role: str = "member"):
    with get_conn() as conn:
        return {"questions": suggest_questions(conn, workspace_id, user_id, role)}


@app.get("/groups", dependencies=[Depends(require_secret)])
def groups_list(workspace_id: str):
    with get_conn() as conn:
        gs = lib_groups.list_groups(conn, workspace_id)
        members = lib_groups.group_member_user_ids(conn, workspace_id)
    return {"groups": [{**g, "member_user_ids": members.get(g["id"], [])} for g in gs]}


class GroupNameBody(BaseModel):
    workspace_id: str
    name: str


@app.post("/groups", dependencies=[Depends(require_secret)])
def groups_create(body: GroupNameBody):
    with get_conn() as conn:
        g = lib_groups.create_group(conn, body.workspace_id, body.name)
    if g is None:
        raise HTTPException(status_code=409, detail="a group with that name already exists")
    return {"group": {**g, "member_user_ids": []}}


@app.patch("/groups/{group_id}", dependencies=[Depends(require_secret)])
def groups_rename(group_id: str, body: GroupNameBody):
    with get_conn() as conn:
        ok = lib_groups.rename_group(conn, body.workspace_id, group_id, body.name)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


@app.delete("/groups/{group_id}", dependencies=[Depends(require_secret)])
def groups_delete(group_id: str, workspace_id: str):
    with get_conn() as conn:
        res = lib_groups.delete_group(conn, workspace_id, group_id)
    if res == "notfound":
        raise HTTPException(status_code=404, detail="not found")
    if res == "default":
        raise HTTPException(status_code=400, detail="the Everyone group cannot be deleted")
    return {"ok": True}


class GroupMembersBody(BaseModel):
    workspace_id: str
    user_ids: list[str] = []


@app.put("/groups/{group_id}/members", dependencies=[Depends(require_secret)])
def groups_set_members(group_id: str, body: GroupMembersBody):
    with get_conn() as conn:
        lib_groups.set_group_members(conn, body.workspace_id, group_id, body.user_ids)
    return {"ok": True}


@app.get("/documents/{document_id}/groups", dependencies=[Depends(require_secret)])
def document_groups_get(document_id: str, workspace_id: str):
    with get_conn() as conn:
        return {"group_ids": lib_groups.document_group_ids(conn, workspace_id, document_id)}


class DocGroupsBody(BaseModel):
    workspace_id: str
    group_ids: list[str] = []


@app.put("/documents/{document_id}/groups", dependencies=[Depends(require_secret)])
def document_groups_set(document_id: str, body: DocGroupsBody):
    with get_conn() as conn:
        lib_groups.set_document_groups(conn, body.workspace_id, document_id, body.group_ids)
    return {"ok": True}


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


@app.get("/telegram/status", dependencies=[Depends(require_secret)])
def telegram_status(workspace_id: str):
    with get_conn() as conn:
        return tg_store.status(conn, workspace_id)


@app.get("/telegram/links", dependencies=[Depends(require_secret)])
def telegram_links(workspace_id: str):
    with get_conn() as conn:
        return {"links": tg_store.list_links(conn, workspace_id)}


class TgLinkActionBody(BaseModel):
    workspace_id: str
    action: str


@app.post("/telegram/links/{link_id}", dependencies=[Depends(require_secret)])
def telegram_link_action(link_id: str, body: TgLinkActionBody):
    with get_conn() as conn:
        res = tg_store.set_link_status(conn, body.workspace_id, link_id, body.action)
    if res == "notfound":
        raise HTTPException(status_code=404, detail="not found")
    if res == "unknown":
        raise HTTPException(status_code=400, detail="unknown action")
    return {"ok": True}


class TgLinkGroupsBody(BaseModel):
    workspace_id: str
    group_ids: list[str] = []


@app.put("/telegram/links/{link_id}/groups", dependencies=[Depends(require_secret)])
def telegram_link_groups(link_id: str, body: TgLinkGroupsBody):
    with get_conn() as conn:
        tg_store.set_link_groups(conn, body.workspace_id, link_id, body.group_ids)
    return {"ok": True}


class GraphRebuildBody(BaseModel):
    workspace_id: str


@app.post("/graph/rebuild", dependencies=[Depends(require_secret)])
def graph_rebuild(body: GraphRebuildBody, background: BackgroundTasks):
    # Start the job row synchronously (before backgrounding the actual build)
    # so the response always carries a 'running' job — never null, never a
    # stale previous job. build_graph is handed this same job_id and reuses
    # it instead of starting a second one, so the client's first poll is
    # guaranteed to observe 'running' and keep polling until 'done'/'failed'.
    with get_conn() as conn:
        job_id = graph_service.store.start_job(conn, body.workspace_id)
        job = graph_service.store.latest_job(conn, body.workspace_id)
    background.add_task(graph_service.build_graph, body.workspace_id, job_id)
    return {"job": job}


@app.get("/graph", dependencies=[Depends(require_secret)])
def graph_get(workspace_id: str, user_id: str = "", role: str = "member", as_group: str = ""):
    return graph_service.get_graph(workspace_id, user_id, role, as_group or None)


@app.get("/graph/topic/{topic_id}", dependencies=[Depends(require_secret)])
def graph_topic(topic_id: str, workspace_id: str, user_id: str = "", role: str = "member",
                as_group: str = ""):
    return graph_service.get_topic(workspace_id, topic_id, user_id, role, as_group or None)


@app.get("/graph/documents", dependencies=[Depends(require_secret)])
def graph_documents(workspace_id: str, user_id: str = "", role: str = "member", as_group: str = ""):
    return graph_service.document_graph(workspace_id, user_id, role, as_group or None)


@app.get("/graph/findings", dependencies=[Depends(require_secret)])
def graph_findings(workspace_id: str, user_id: str = "", role: str = "member",
                    as_group: str = "", kind: str = ""):
    return {"findings": graph_service.list_findings(
        workspace_id, user_id, role, as_group or None, kind or None)}


class GraphWsBody(BaseModel):
    workspace_id: str


@app.post("/graph/findings/{finding_id}/dismiss", dependencies=[Depends(require_secret)])
def graph_dismiss(finding_id: str, body: GraphWsBody):
    if not graph_service.dismiss_finding(body.workspace_id, finding_id):
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}

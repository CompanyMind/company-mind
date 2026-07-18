def get_source(
    conn, workspace_id: str, chunk_id: str, group_ids: list[str], all_access: bool
) -> dict | None:
    """Resolve a chunk to a viewable, highlightable source — but only if the caller
    may see the document (owner bypass, or the document's groups intersect the
    caller's). Returns None when missing or not permitted (no leak either way).
    Ported verbatim from the web app's lib/source.ts."""
    chunk = conn.execute(
        "SELECT document_id, text, page, char_start, char_end "
        "FROM chunks WHERE id=%s AND workspace_id=%s",
        (chunk_id, workspace_id),
    ).fetchone()
    if not chunk:
        return None
    document_id, ctext, page, cstart, cend = chunk

    doc = conn.execute(
        "SELECT filename, extracted_text FROM documents WHERE id=%s AND workspace_id=%s",
        (document_id, workspace_id),
    ).fetchone()
    if not doc:
        return None
    filename, extracted = doc

    if not all_access:
        dg = conn.execute(
            "SELECT group_id FROM document_groups WHERE document_id=%s", (document_id,)
        ).fetchall()
        if not any(str(g[0]) in group_ids for g in dg):
            return None

    if extracted and cstart is not None and cend is not None and cend <= len(extracted):
        return {
            "filename": filename,
            "page": page,
            "char_start": cstart,
            "char_end": cend,
            "text": extracted,
        }
    # Fallback for documents ingested before extracted_text existed: show the chunk.
    return {
        "filename": filename,
        "page": page,
        "char_start": 0,
        "char_end": len(ctext),
        "text": ctext,
    }

def contextualize(text: str, filename: str, page: int | None, mode: str = "header") -> str:
    """Enrich a chunk BEFORE embedding while the raw `text` is stored for
    citation. 'header' prepends a source line so short chunks carry provenance
    signal (Anthropic contextual retrieval, lightweight variant)."""
    if mode == "off":
        return text
    head = filename if page is None else f"{filename} · p.{page}"
    return f"{head}\n\n{text}"

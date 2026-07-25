from dataclasses import dataclass

from .chunk import Chunk, chunk_text
from .contextualize import contextualize
from .embed import get_provider
from .parse import ParsedDoc, extract_text


@dataclass
class Prepared:
    parsed: ParsedDoc
    chunks: list[Chunk]
    embed_inputs: list[str]
    vectors: list[list[float]]


def prepare_document(filename: str, mime: str, data: bytes, mode: str) -> Prepared:
    """Parse -> chunk -> contextualize -> embed, with NO database access.

    Deliberately DB-free: embedding is a network call that can take a minute, and
    the pool has ten connections. Holding one across it starves every ask, Telegram
    poll and Atlas request. store.py brackets this call with two short transactions
    instead of wrapping it in one long-lived connection."""
    parsed = extract_text(filename, mime, data)
    chunks = chunk_text(parsed.text, parsed.pages)
    # Embed a contextualized representation (filename/page header) while the raw
    # chunk text is stored for citations.
    embed_inputs = [contextualize(c.text, filename, c.page, mode) for c in chunks]
    vectors = get_provider().embed(embed_inputs) if chunks else []
    return Prepared(parsed=parsed, chunks=chunks, embed_inputs=embed_inputs, vectors=vectors)

from dataclasses import dataclass
import re

from .parse import Page


@dataclass
class Chunk:
    ordinal: int
    text: str
    page: int | None
    char_start: int
    char_end: int
    token_count: int


def _page_for(pages: list[Page], pos: int) -> int | None:
    for p in pages:
        if p.start <= pos < p.end:
            return p.page
    return pages[-1].page if pages else None


def chunk_text(
    text: str,
    pages: list[Page],
    target_words: int = 300,
    overlap_words: int = 50,
) -> list[Chunk]:
    # Fixed-size sliding window of whitespace-delimited words: 300-word chunks
    # with 50 words of overlap by default. Each word keeps its char span so a
    # chunk maps back to the exact source offsets that citations highlight.
    words = [(m.group(0), m.start(), m.end()) for m in re.finditer(r"\S+", text)]
    if not words:
        return []
    step = max(1, target_words - overlap_words)
    chunks: list[Chunk] = []
    ordinal = 0
    for i in range(0, len(words), step):
        window = words[i : i + target_words]
        if not window:
            break
        start = window[0][1]
        end = window[-1][2]
        chunks.append(
            Chunk(
                ordinal=ordinal,
                text=text[start:end],
                page=_page_for(pages, start),
                char_start=start,
                char_end=end,
                token_count=len(window),
            )
        )
        ordinal += 1
        if i + target_words >= len(words):
            break
    return chunks

from bisect import bisect_right
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


def _page_for(pages: list[Page], pos: int, starts: list[int] | None = None) -> int | None:
    """The page a character offset falls on.

    Binary search, not a linear scan. `pages` comes from parse.py in ascending,
    non-overlapping start order, so bisect applies. The scan was O(pages) and
    this is called once per chunk: a 600-page PDF chunked into ~2000 pieces
    spent 1.2M comparisons computing page numbers.

    `starts` is hoisted by the caller — building it here would reintroduce the
    O(pages)-per-chunk cost the bisect exists to remove.

    Behaviour is identical to the scan it replaces, INCLUDING the fallthrough:
    an offset that lands in no page's range (the "\\n\\n" parse.py inserts
    between pages, or anything past the last page) yields the LAST page. That
    case is unreachable from chunk_text — a chunk's char_start is always a
    non-whitespace word start — but "unreachable" is not a reason to change what
    the function returns.
    """
    if not pages:
        return None
    if starts is None:
        starts = [p.start for p in pages]
    i = bisect_right(starts, pos) - 1
    if i >= 0 and pages[i].start <= pos < pages[i].end:
        return pages[i].page
    return pages[-1].page


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
    page_starts = [p.start for p in pages]  # hoisted: see _page_for
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
                page=_page_for(pages, start, page_starts),
                char_start=start,
                char_end=end,
                token_count=len(window),
            )
        )
        ordinal += 1
        if i + target_words >= len(words):
            break
    return chunks

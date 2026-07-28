from app.ingest.parse import Page
from app.ingest.chunk import chunk_text


def test_chunks_cover_text_with_offsets():
    text = " ".join(f"w{i}" for i in range(300))
    pages = [Page(page=1, start=0, end=len(text))]
    chunks = chunk_text(text, pages, target_words=50, overlap_words=10)
    assert len(chunks) >= 5
    for c in chunks:
        assert 0 <= c.char_start < c.char_end <= len(text)
        assert text[c.char_start : c.char_end] == c.text
        assert c.page == 1
    assert [c.ordinal for c in chunks] == list(range(len(chunks)))


def test_overlap_repeats_words():
    text = " ".join(f"w{i}" for i in range(100))
    pages = [Page(page=1, start=0, end=len(text))]
    chunks = chunk_text(text, pages, target_words=30, overlap_words=10)
    assert chunks[1].char_start < chunks[0].char_end


def test_empty_text_no_chunks():
    assert chunk_text("", [], target_words=50, overlap_words=10) == []


def test_page_for_matches_the_linear_scan_it_replaced():
    """`_page_for` became a bisect (it was O(pages) per chunk, called once per
    chunk). Equivalence is asserted against the exact scan it replaced, over
    every offset of a page layout that includes gaps, an empty page, and
    offsets past the end — not just the offsets chunk_text happens to produce.
    """
    from app.ingest.chunk import _page_for
    from app.ingest.parse import Page

    def scan(pages, pos):
        for p in pages:
            if p.start <= pos < p.end:
                return p.page
        return pages[-1].page if pages else None

    layouts = [
        [],
        [Page(1, 0, 10)],
        # Consecutive pages with the "\n\n" gaps parse.py inserts.
        [Page(1, 0, 10), Page(2, 12, 25), Page(3, 27, 40)],
        # An empty page in the middle (a PDF page with no text layer).
        [Page(1, 0, 10), Page(2, 12, 12), Page(3, 14, 30)],
        # Two empty pages back to back.
        [Page(1, 0, 5), Page(2, 7, 7), Page(3, 9, 9), Page(4, 11, 20)],
    ]

    for pages in layouts:
        starts = [p.start for p in pages]
        for pos in range(-2, 50):
            assert _page_for(pages, pos, starts) == scan(pages, pos), (
                f"layout={pages} pos={pos}"
            )
        # And with starts computed internally, the path other callers take.
        for pos in range(0, 45):
            assert _page_for(pages, pos) == scan(pages, pos)


def test_chunk_pages_are_unchanged_for_a_realistic_multi_page_document():
    """End-to-end guard on the same change: real chunking over real page
    boundaries must assign the same page numbers as before."""
    from app.ingest.chunk import chunk_text
    from app.ingest.parse import _from_pages

    page_texts = [" ".join(f"page{p}word{i}" for i in range(120)) for p in range(1, 6)]
    parsed = _from_pages(page_texts)
    chunks = chunk_text(parsed.text, parsed.pages, target_words=50, overlap_words=10)

    assert chunks, "expected chunks"
    for c in chunks:
        # Every chunk's page must be the page its first word actually sits on.
        first_word = parsed.text[c.char_start :].split(maxsplit=1)[0]
        assert first_word.startswith(f"page{c.page}"), (
            f"chunk at {c.char_start} labelled page {c.page} but starts with {first_word!r}"
        )

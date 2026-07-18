from app.ingest.parse import Page
from app.ingest.chunk import chunk_text


def test_chunks_cover_text_with_offsets():
    text = " ".join(f"w{i}" for i in range(300))
    pages = [Page(page=1, start=0, end=len(text))]
    chunks = chunk_text(text, pages, target_tokens=50, overlap=10)
    assert len(chunks) >= 5
    for c in chunks:
        assert 0 <= c.char_start < c.char_end <= len(text)
        assert text[c.char_start : c.char_end] == c.text
        assert c.page == 1
    assert [c.ordinal for c in chunks] == list(range(len(chunks)))


def test_overlap_repeats_words():
    text = " ".join(f"w{i}" for i in range(100))
    pages = [Page(page=1, start=0, end=len(text))]
    chunks = chunk_text(text, pages, target_tokens=30, overlap=10)
    assert chunks[1].char_start < chunks[0].char_end


def test_empty_text_no_chunks():
    assert chunk_text("", [], target_tokens=50, overlap=10) == []

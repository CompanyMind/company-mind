import pytest

from app.ingest.parse import extract_text, UnsupportedType


def test_txt_single_page():
    doc = extract_text("a.txt", "text/plain", b"hello world")
    assert doc.text == "hello world"
    assert len(doc.pages) == 1
    assert doc.pages[0].start == 0 and doc.pages[0].end == len("hello world")


def test_markdown_is_text():
    doc = extract_text("a.md", "text/markdown", b"# Title\n\nBody")
    assert "Title" in doc.text and "Body" in doc.text


def test_unsupported_raises():
    with pytest.raises(UnsupportedType):
        extract_text("a.exe", "application/octet-stream", b"\x00")

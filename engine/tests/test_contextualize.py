from app.ingest.contextualize import contextualize


def test_off_returns_raw():
    assert contextualize("body", "f.pdf", 3, mode="off") == "body"


def test_header_prepends_filename_and_page_and_keeps_body():
    out = contextualize("body text", "deploy.pdf", 3, mode="header")
    assert out.startswith("deploy.pdf")
    assert "p.3" in out
    assert out.endswith("body text")


def test_header_without_page():
    out = contextualize("body", "notes.txt", None, mode="header")
    assert "notes.txt" in out and "body" in out and "p." not in out

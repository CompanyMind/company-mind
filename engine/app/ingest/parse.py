from dataclasses import dataclass
from io import BytesIO


class UnsupportedType(Exception):
    pass


@dataclass
class Page:
    page: int
    start: int
    end: int


@dataclass
class ParsedDoc:
    text: str
    pages: list[Page]


def _from_pages(page_texts: list[str]) -> ParsedDoc:
    """Join per-page texts and record each page's char range over the result."""
    parts: list[str] = []
    pages: list[Page] = []
    cursor = 0
    for i, pt in enumerate(page_texts, start=1):
        if i > 1:
            parts.append("\n\n")
            cursor += 2
        start = cursor
        parts.append(pt)
        cursor += len(pt)
        pages.append(Page(page=i, start=start, end=cursor))
    return ParsedDoc(text="".join(parts), pages=pages)


def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def extract_text(filename: str, mime: str, data: bytes) -> ParsedDoc:
    ext = _ext(filename)
    if ext in ("txt", "md") or mime in ("text/plain", "text/markdown"):
        text = data.decode("utf-8", errors="replace")
        return ParsedDoc(text=text, pages=[Page(page=1, start=0, end=len(text))])
    if ext == "pdf" or mime == "application/pdf":
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data))
        return _from_pages([(p.extract_text() or "") for p in reader.pages])
    if ext == "docx" or mime == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        import docx

        d = docx.Document(BytesIO(data))
        text = "\n".join(p.text for p in d.paragraphs)
        return ParsedDoc(text=text, pages=[Page(page=1, start=0, end=len(text))])
    raise UnsupportedType(f"{filename} ({mime})")

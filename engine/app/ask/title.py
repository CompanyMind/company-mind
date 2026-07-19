from collections.abc import Callable


def _fallback(text: str) -> str:
    trimmed = text.strip()
    if len(trimmed) <= 48:
        return trimmed
    cut = trimmed[:48]
    last_space = cut.rfind(" ")
    return (cut[:last_space] if last_space > 20 else cut).strip()


def generate_title(text: str, call: Callable[[str], str] | None = None) -> str:
    if call is None:
        return _fallback(text)
    prompt = (
        "Write a 3-6 word title (no quotes, no trailing punctuation) for a "
        "conversation that begins with this message:\n\n"
        f"{text}\n\nTitle:"
    )
    try:
        raw = call(prompt)
        title = raw.strip().strip('"').strip().splitlines()[0].strip() if raw else ""
        title = title.rstrip(".!?,;: ")
    except Exception:  # noqa: BLE001 — title generation never blocks a turn
        return _fallback(text)
    return title[:60] or _fallback(text)

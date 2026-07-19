from collections.abc import Callable


def _fallback(keywords: list[str]) -> str:
    kws = [k for k in keywords if k][:2]
    if not kws:
        return "Untitled topic"
    return " · ".join(w.capitalize() for w in kws)


def label_cluster(
    keywords: list[str], titles: list[str], call: Callable[[str], str] | None = None
) -> str:
    if call is None:
        return _fallback(keywords)
    prompt = (
        "Name this cluster of company documents in 2-4 words. Reply with only the name.\n"
        f"Keywords: {', '.join(keywords) or '(none)'}\n"
        f"Example titles: {', '.join(titles[:5]) or '(none)'}\n"
    )
    try:
        raw = call(prompt)
        label = raw.strip().strip('"').strip().splitlines()[0].strip() if raw else ""
    except Exception:  # noqa: BLE001 — labeling never blocks a build
        return _fallback(keywords)
    return label[:60] or _fallback(keywords)

import re
from dataclasses import dataclass

import httpx

from ..settings import settings, use_real_models
from .retrieve import Retrieved

REFUSAL = "I couldn't find anything in your sources to answer that."

SYSTEM = (
    "You answer strictly from the provided sources. Cite every claim with [n] "
    "referring to the numbered source it came from. If the sources do not contain "
    "the answer, reply exactly: " + REFUSAL + " Do not use outside knowledge."
)


@dataclass
class Citation:
    marker: int
    chunk_id: str
    document_id: str
    filename: str
    page: int | None
    snippet: str


@dataclass
class Answered:
    answer: str
    citations: list[Citation]
    insufficient: bool


def _context_block(retrieved: list[Retrieved]) -> str:
    # Feed the neighbor-expanded context to the model; citations still resolve to
    # the matched span (r.text) below.
    return "\n\n".join(f"[{i}] {r.context or r.text}" for i, r in enumerate(retrieved, start=1))


def _fake_answer(question: str, retrieved: list[Retrieved]) -> str:
    first = retrieved[0].text.strip()
    snippet = (first[:200] + "…") if len(first) > 200 else first
    out = f"Based on your sources: {snippet} [1]"
    if len(retrieved) > 1:
        out += " There is related detail as well [2]."
    return out


def _llm_answer(question: str, retrieved: list[Retrieved]) -> str:
    headers = (
        {"Authorization": f"Bearer {settings.openai_api_key}"}
        if settings.openai_api_key
        else {}
    )
    r = httpx.post(
        f"{settings.models_base_url.rstrip('/')}/chat/completions",
        json={
            "model": settings.llm_model,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {
                    "role": "user",
                    "content": f"Sources:\n{_context_block(retrieved)}\n\nQuestion: {question}",
                },
            ],
            "temperature": 0,
        },
        headers=headers,
        timeout=120,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def answer_question(question: str, retrieved: list[Retrieved]) -> Answered:
    if not retrieved:
        return Answered(REFUSAL, [], True)

    text = (
        _llm_answer(question, retrieved)
        if use_real_models()
        else _fake_answer(question, retrieved)
    )

    if text.strip() == REFUSAL:
        return Answered(REFUSAL, [], True)

    # Resolve [n] markers to the numbered context; drop any that don't resolve.
    seen: dict[int, Citation] = {}
    for m in re.findall(r"\[(\d+)\]", text):
        n = int(m)
        if 1 <= n <= len(retrieved) and n not in seen:
            r = retrieved[n - 1]
            snippet = (r.text[:280] + "…") if len(r.text) > 280 else r.text
            seen[n] = Citation(n, r.chunk_id, r.document_id, r.filename, r.page, snippet)
    return Answered(text, list(seen.values()), False)

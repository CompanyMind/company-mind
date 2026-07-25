import json
import re
from dataclasses import dataclass
from typing import Callable, Protocol

import httpx

from ..settings import settings, use_real_models


@dataclass
class RerankItem:
    chunk_id: str
    text: str


class Reranker(Protocol):
    def rerank(
        self, query: str, items: list[RerankItem], top_k: int, degraded: list[str] | None = None
    ) -> list[str]: ...


def _note(degraded: list[str] | None, reason: str) -> None:
    if degraded is not None:
        degraded.append(reason)


class FakeReranker:
    """Identity: keep fusion order, truncate. Used offline and in tests."""

    def rerank(
        self, query: str, items: list[RerankItem], top_k: int, degraded: list[str] | None = None
    ) -> list[str]:
        return [it.chunk_id for it in items[:top_k]]


_RERANK_PROMPT = (
    "You are a reranker. Given a question and numbered candidate passages, return the "
    "passages most likely to answer the question, best first. Respond ONLY with a JSON "
    'array of objects {{"index": <1-based int>, "score": <0-10>}}. Question: {q}\n\n{cands}'
)


class LLMReranker:
    """One batched chat call scores candidates. `call` is injected for tests; in
    production it posts to the configured chat endpoint."""

    def __init__(self, call: Callable[[str], str] | None = None) -> None:
        self._call = call or self._http_call

    def _http_call(self, prompt: str) -> str:
        headers = (
            {"Authorization": f"Bearer {settings.openai_api_key}"}
            if settings.openai_api_key
            else {}
        )
        r = httpx.post(
            f"{settings.models_base_url.rstrip('/')}/chat/completions",
            json={
                "model": settings.llm_model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
            },
            headers=headers,
            timeout=60,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]

    def rerank(
        self, query: str, items: list[RerankItem], top_k: int, degraded: list[str] | None = None
    ) -> list[str]:
        cands = "\n".join(f"[{i}] {it.text}" for i, it in enumerate(items, start=1))
        try:
            raw = self._call(_RERANK_PROMPT.format(q=query, cands=cands))
            m = re.search(r"\[.*\]", raw, re.DOTALL)
            parsed = json.loads(m.group(0) if m else raw)
            order: list[str] = []
            for row in parsed:
                idx = int(row["index"]) - 1
                if 0 <= idx < len(items) and items[idx].chunk_id not in order:
                    order.append(items[idx].chunk_id)
            if order:
                if len(order) < min(top_k, len(items)):
                    _note(degraded, f"rerank_short_response:{len(order)}/{min(top_k, len(items))}")
                return order[:top_k]
            _note(degraded, "rerank_unparseable:empty_order")
        except Exception as e:  # noqa: BLE001 — never let reranking break the answer
            _note(degraded, f"rerank_unparseable:{type(e).__name__}")
        return [it.chunk_id for it in items[:top_k]]


class CrossEncoderReranker:
    """Cohere/Jina/TEI-style POST {base}/rerank — for a self-hosted bge-reranker."""

    def rerank(
        self, query: str, items: list[RerankItem], top_k: int, degraded: list[str] | None = None
    ) -> list[str]:
        try:
            r = httpx.post(
                f"{settings.rerank_base_url.rstrip('/')}/rerank",
                json={
                    "model": settings.rerank_model,
                    "query": query,
                    "documents": [it.text for it in items],
                    "top_n": top_k,
                },
                timeout=60,
            )
            r.raise_for_status()
            results = r.json()["results"]
            return [items[row["index"]].chunk_id for row in results][:top_k]
        except httpx.HTTPStatusError as e:
            _note(degraded, f"rerank_http_error:{e.response.status_code}")
        except Exception as e:  # noqa: BLE001
            _note(degraded, f"rerank_error:{type(e).__name__}")
        return [it.chunk_id for it in items[:top_k]]


def get_reranker() -> Reranker:
    if settings.rerank_base_url:
        return CrossEncoderReranker()
    if use_real_models():
        return LLMReranker()
    return FakeReranker()

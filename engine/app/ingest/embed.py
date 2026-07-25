import hashlib
import math
from typing import Protocol

import httpx

from ..settings import settings, use_real_models


class EmbeddingsProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class FakeEmbeddings:
    """Deterministic, unit-norm pseudo-embeddings from a text hash. Dev/test only —
    structurally valid (right dim, stable) but not semantic. Used when no
    MODELS_BASE_URL is configured, so the pipeline runs before the GPU box exists."""

    def __init__(self, dim: int) -> None:
        self.dim = dim

    def _vec(self, text: str) -> list[float]:
        vals: list[float] = []
        counter = 0
        while len(vals) < self.dim:
            h = hashlib.sha256(f"{text}:{counter}".encode()).digest()
            for i in range(0, len(h), 4):
                if len(vals) >= self.dim:
                    break
                n = int.from_bytes(h[i : i + 4], "big")
                vals.append((n / 2**32) * 2 - 1)  # [-1, 1)
            counter += 1
        norm = math.sqrt(sum(v * v for v in vals)) or 1.0
        return [v / norm for v in vals]

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._vec(t) for t in texts]


class EmbeddingCountMismatch(Exception):
    """The provider returned a different number of vectors than we sent texts.
    Never recoverable by guessing — misaligned vectors corrupt the index silently."""


class OpenAICompatEmbeddings:
    def __init__(
        self,
        base_url: str,
        model: str,
        dim: int,
        api_key: str = "",
        batch_size: int = 32,
        post=None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.dim = dim
        self.api_key = api_key
        self.batch_size = max(1, batch_size)
        self._post = post or self._http_post

    def _http_post(self, url: str, body: dict, headers: dict) -> dict:
        r = httpx.post(url, json=body, headers=headers, timeout=60)
        r.raise_for_status()
        return r.json()

    def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        # `dimensions` pins the output width to EMBED_DIM — OpenAI text-embedding-3-*
        # supports it; self-hosted OpenAI-compatible servers accept or ignore it.
        body = {"model": self.model, "input": batch, "dimensions": self.dim}
        data = self._post(f"{self.base_url}/embeddings", body, headers)["data"]
        if len(data) != len(batch):
            raise EmbeddingCountMismatch(f"sent {len(batch)} texts, got {len(data)} vectors")
        # Order by the response's own `index` — the schema carries it precisely
        # because positional order is not guaranteed. Fall back to position only
        # when a server omits the field entirely.
        indexed = [(row.get("index", i), row["embedding"]) for i, row in enumerate(data)]
        indexed.sort(key=lambda pair: pair[0])
        return [vec for _, vec in indexed]

    def embed(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for start in range(0, len(texts), self.batch_size):
            out.extend(self._embed_batch(texts[start : start + self.batch_size]))
        if len(out) != len(texts):
            raise EmbeddingCountMismatch(f"sent {len(texts)} texts, got {len(out)} vectors")
        return out


def get_provider() -> EmbeddingsProvider:
    if use_real_models():
        return OpenAICompatEmbeddings(
            settings.models_base_url,
            settings.embed_model,
            settings.embed_dim,
            settings.openai_api_key,
            settings.embed_batch_size,
        )
    return FakeEmbeddings(settings.embed_dim)

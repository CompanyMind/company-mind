import hashlib
import math
from typing import Protocol

import httpx

from ..settings import settings


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


class OpenAICompatEmbeddings:
    def __init__(self, base_url: str, model: str, dim: int) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.dim = dim

    def embed(self, texts: list[str]) -> list[list[float]]:
        r = httpx.post(
            f"{self.base_url}/embeddings",
            json={"model": self.model, "input": texts},
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()["data"]
        return [row["embedding"] for row in data]


def get_provider() -> EmbeddingsProvider:
    if settings.models_base_url:
        return OpenAICompatEmbeddings(
            settings.models_base_url, settings.embed_model, settings.embed_dim
        )
    return FakeEmbeddings(settings.embed_dim)

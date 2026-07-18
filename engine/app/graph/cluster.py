import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer


def _k_for(n: int) -> int:
    if n <= 1:
        return 1
    return max(1, min(50, round((n**0.5) / 2)))


def cluster_docs(vectors: np.ndarray, seed: int = 42) -> np.ndarray:
    """KMeans cluster index per row. Deterministic for a fixed seed.

    k = clamp(round(sqrt(n) / 2), 1, 50) (1 when n is tiny)."""
    n = vectors.shape[0]
    k = _k_for(n)
    if k <= 1:
        return np.zeros(n, dtype=int)
    km = KMeans(n_clusters=k, random_state=seed, n_init=10)
    return km.fit_predict(vectors)


def keywords_per_cluster(
    texts: list[str], labels: np.ndarray, top_n: int = 6
) -> dict[int, list[str]]:
    """Top TF-IDF terms for each cluster, computed by treating each cluster's
    concatenated text as one document."""
    out: dict[int, list[str]] = {}
    order = sorted(set(int(x) for x in labels))
    docs = [" ".join(t for t, l in zip(texts, labels) if int(l) == c) for c in order]
    if not any(d.strip() for d in docs):
        return {c: [] for c in order}
    vec = TfidfVectorizer(stop_words="english", max_features=2000)
    m = vec.fit_transform(docs)
    terms = np.array(vec.get_feature_names_out())
    for i, c in enumerate(order):
        row = m[i].toarray().ravel()
        # Sort by score descending; break ties alphabetically by term so results
        # are deterministic when TF-IDF scores tie exactly (e.g. every term in a
        # cluster's doc is unique to it and appears with equal frequency).
        idx = np.lexsort((terms, -row))[:top_n]
        out[c] = [terms[j] for j in idx if row[j] > 0]
    return out

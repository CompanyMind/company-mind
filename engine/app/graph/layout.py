import numpy as np
from sklearn.decomposition import PCA


def layout_positions(centroids: np.ndarray, seed: int = 42) -> np.ndarray:
    """Project topic centroids to 2D via PCA and normalize to ~[-1, 1].
    Deterministic (PCA sign is pinned so the map is stable across builds)."""
    n = centroids.shape[0]
    if n == 1:
        return np.zeros((1, 2))
    p = PCA(n_components=2, random_state=seed).fit_transform(centroids)
    # Pin sign: force the largest-|value| entry of each axis positive.
    for a in range(2):
        j = np.argmax(np.abs(p[:, a]))
        if p[j, a] < 0:
            p[:, a] = -p[:, a]
    span = np.max(np.abs(p)) or 1.0
    return p / span

import numpy as np
from app.graph.layout import layout_positions


def test_positions_are_2d_deterministic_and_bounded():
    c = np.random.default_rng(1).normal(0, 1, (12, 8)).astype(np.float32)
    p1 = layout_positions(c, seed=42)
    p2 = layout_positions(c, seed=42)
    assert p1.shape == (12, 2)
    assert np.allclose(p1, p2)
    assert p1.min() >= -1.0001 and p1.max() <= 1.0001


def test_single_topic_at_origin():
    assert layout_positions(np.zeros((1, 4), np.float32)).tolist() == [[0.0, 0.0]]

from app.ingest.embed import FakeEmbeddings


def test_fake_is_deterministic_and_right_dim():
    p = FakeEmbeddings(dim=1024)
    a = p.embed(["hello", "world"])
    b = p.embed(["hello", "world"])
    assert len(a) == 2 and len(a[0]) == 1024
    assert a == b  # deterministic
    assert p.embed(["hello"])[0] != p.embed(["different"])[0]

import pytest

from app.ingest.embed import EmbeddingCountMismatch, FakeEmbeddings, OpenAICompatEmbeddings


def test_fake_is_deterministic_and_right_dim():
    p = FakeEmbeddings(dim=1024)
    a = p.embed(["hello", "world"])
    b = p.embed(["hello", "world"])
    assert len(a) == 2 and len(a[0]) == 1024
    assert a == b  # deterministic
    assert p.embed(["hello"])[0] != p.embed(["different"])[0]


def test_response_order_is_honoured_not_assumed():
    """The OpenAI embeddings schema carries an explicit `index`; a server is free to
    return rows out of order. Trusting positional order silently pairs every chunk
    with the wrong vector."""
    calls = []

    def fake_post(url, body, headers):
        calls.append(body)
        # Deliberately shuffled: index 2, 0, 1.
        return {"data": [
            {"index": 2, "embedding": [2.0]},
            {"index": 0, "embedding": [0.0]},
            {"index": 1, "embedding": [1.0]},
        ]}

    emb = OpenAICompatEmbeddings("http://x/v1", "m", 1, post=fake_post)
    assert emb.embed(["a", "b", "c"]) == [[0.0], [1.0], [2.0]]
    assert len(calls) == 1


def test_inputs_are_batched():
    """TEI's default max-client-batch-size is 32; one request per document fails
    for any document over roughly 16 pages. Verify order is preserved across batches."""
    sizes = []
    call_counter = [0]  # Track global position across batches

    def fake_post(url, body, headers):
        n = len(body["input"])
        sizes.append(n)
        # Return globally-unique values using a running counter, so we can detect
        # if batches are reordered, mis-sliced, or concatenated out of order.
        start = call_counter[0]
        call_counter[0] += n
        return {"data": [{"index": i, "embedding": [float(start + i)]} for i in range(n)]}

    emb = OpenAICompatEmbeddings("http://x/v1", "m", 1, batch_size=32, post=fake_post)
    out = emb.embed([f"t{i}" for i in range(70)])
    assert sizes == [32, 32, 6]
    assert len(out) == 70
    # Verify the actual output is in the correct order with globally-unique values.
    # Batch 1: [0.0] through [31.0]; batch 2: [32.0] through [63.0]; batch 3: [64.0] through [69.0].
    expected = [[float(i)] for i in range(70)]
    assert out == expected


def test_short_response_raises_instead_of_misaligning():
    def fake_post(url, body, headers):
        return {"data": [{"index": 0, "embedding": [0.0]}]}

    emb = OpenAICompatEmbeddings("http://x/v1", "m", 1, post=fake_post)
    with pytest.raises(EmbeddingCountMismatch):
        emb.embed(["a", "b"])


def test_short_response_in_later_batch_raises_immediately():
    """Ensure a mismatch on any batch (not just the first) is caught and aborts,
    rather than partially aggregating incorrect results."""
    call_count = [0]

    def fake_post(url, body, headers):
        call_count[0] += 1
        n = len(body["input"])
        if call_count[0] == 2:
            # Second batch should return 32 embeddings but return only 31, triggering error.
            return {"data": [{"index": i, "embedding": [float(i)]} for i in range(n - 1)]}
        return {"data": [{"index": i, "embedding": [float(i)]} for i in range(n)]}

    emb = OpenAICompatEmbeddings("http://x/v1", "m", 1, batch_size=32, post=fake_post)
    with pytest.raises(EmbeddingCountMismatch):
        emb.embed([f"t{i}" for i in range(70)])

from app.ask.telemetry import RetrievalDebug, stage


def test_stage_records_elapsed_time():
    dbg = RetrievalDebug()
    with stage(dbg, "dense"):
        pass
    assert "dense" in dbg.timings_ms
    assert dbg.timings_ms["dense"] >= 0.0


def test_as_dict_is_json_safe():
    dbg = RetrievalDebug(dense_n=40, lexical_n=0, fused_n=40, rerank_in_n=20, final_n=8)
    dbg.degraded.append("rerank_http_error:422")
    d = dbg.as_dict()
    assert d["candidate_counts"] == {
        "dense": 40, "lexical": 0, "fused": 40, "rerank_in": 20, "final": 8
    }
    assert d["degraded"] == ["rerank_http_error:422"]
    assert d["rerank_applied"] is False


def test_empty_lexical_arm_is_itself_a_degradation():
    """A zero-row lexical arm means hybrid retrieval silently became dense-only —
    the single most likely cause of the accuracy complaint."""
    dbg = RetrievalDebug(dense_n=40, lexical_n=0)
    dbg.finalize()
    assert "lexical_arm_empty" in dbg.degraded

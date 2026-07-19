import numpy as np
from app.graph.model import DocInfo
from app.graph import lenses


def _d(id, groups, vec, days=1.0, retrieved=True, cluster=0):
    return DocInfo(id, set(groups), np.array(vec, float), days, retrieved, cluster)


def test_exposure_everyone_is_max():
    assert lenses.exposure_score({"ev"}, "ev", 4) == 1.0
    assert lenses.exposure_score({"g1"}, "ev", 4) < 1.0
    assert lenses.exposure_score(set(), "ev", 4) == 0.0


def test_permission_anomaly_flags_the_odd_one_out():
    fin = "finance"
    members = [_d(f"d{i}", [fin], [1, 0]) for i in range(11)]
    members.append(_d("odd", ["ev"], [1, 0]))  # tagged Everyone in a Finance cluster
    out = lenses.permission_findings(members, everyone_id="ev")
    assert any(f.document_id == "odd" and f.kind == "permission_anomaly" for f in out)
    assert all(f.document_id != "d0" for f in out)  # consensus docs not flagged


def test_orphan_when_far_from_clustermates():
    members = [_d("a", ["g"], [1, 0]), _d("b", ["g"], [1, 0.01]),
               _d("far", ["g"], [0, 1])]
    out = {f.document_id for f in lenses.orphan_docs(members, threshold=0.5)}
    assert "far" in out and "a" not in out


def test_dead_and_stale():
    docs = [_d("dead", ["g"], [1, 0], retrieved=False),
            _d("old", ["g"], [1, 0], days=900),
            _d("fresh", ["g"], [1, 0], days=1)]
    kinds = {(f.document_id, f.kind) for f in lenses.dead_stale_findings(docs, stale_days=365)}
    assert ("dead", "dead") in kinds
    assert ("old", "stale") in kinds
    assert ("fresh", "stale") not in kinds and ("fresh", "dead") not in kinds

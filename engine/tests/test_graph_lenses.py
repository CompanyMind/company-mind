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


def test_permission_anomaly_flags_empty_groups_as_siloed():
    fin = "finance"
    members = [_d(f"d{i}", [fin], [1, 0]) for i in range(5)]
    members.append(_d("nogroup", [], [1, 0]))  # no groups at all in a Finance cluster
    out = lenses.permission_findings(members, everyone_id="ev")
    flagged = {f.document_id: f for f in out}
    assert "nogroup" in flagged
    assert flagged["nogroup"].kind == "permission_anomaly"
    assert flagged["nogroup"].detail["direction"] == "siloed"
    assert all(f"d{i}" not in flagged for i in range(5))  # consensus docs not flagged


def test_orphan_singleton_cluster_is_flagged():
    members = [_d("solo", ["g"], [1, 0], cluster=7)]
    out = lenses.orphan_docs(members, threshold=0.15)
    assert any(f.document_id == "solo" and f.kind == "orphan" for f in out)


def test_cos_zero_norm_vector_returns_zero_without_raising():
    assert lenses._cos(np.array([0.0, 0.0]), np.array([1.0, 0.0])) == 0.0
    assert lenses._cos(np.array([1.0, 0.0]), np.array([0.0, 0.0])) == 0.0
    assert lenses._cos(np.array([0.0, 0.0]), np.array([0.0, 0.0])) == 0.0
    # exercised end-to-end through orphan_docs as well: a zero vector never
    # clears the similarity threshold, so it is always its own orphan
    members = [_d("zero", ["g"], [0, 0]), _d("other", ["g"], [1, 0])]
    out = {f.document_id for f in lenses.orphan_docs(members, threshold=0.15)}
    assert "zero" in out


def test_permission_findings_skips_sub_minimum_cluster():
    members = [_d(f"s{i}", ["ev"], [1, 0]) for i in range(3)]  # cluster of 3 < min of 4
    assert lenses.permission_findings(members, everyone_id="ev") == []


def test_dead_and_stale_can_both_apply_to_one_doc():
    docs = [_d("worst", ["g"], [1, 0], days=900, retrieved=False)]
    kinds = {f.kind for f in lenses.dead_stale_findings(docs, stale_days=365)
             if f.document_id == "worst"}
    assert kinds == {"dead", "stale"}

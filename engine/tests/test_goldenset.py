import json

import pytest

from evals.goldenset import GoldenQuestion, load_golden


def _write(tmp_path, records):
    p = tmp_path / "golden.jsonl"
    p.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in records), encoding="utf-8")
    return str(p)


def test_loads_a_valid_record(tmp_path):
    path = _write(tmp_path, [{
        "id": "q1", "question": "Каков срок хранения данных?", "lang": "ru", "qtype": "lookup",
        "answerable": True, "gold_filenames": ["policy-ru.txt"],
        "gold_quotes": ["срок хранения — 7 лет"], "group_names": ["Finance"],
        "all_access": False, "must_not_retrieve": ["hr-secret.txt"],
    }])
    qs = load_golden(path)
    assert len(qs) == 1
    assert isinstance(qs[0], GoldenQuestion)
    assert qs[0].lang == "ru"
    assert qs[0].must_not_retrieve == ["hr-secret.txt"]


def test_unanswerable_question_needs_no_gold(tmp_path):
    path = _write(tmp_path, [{
        "id": "q2", "question": "What is our policy on Mars colonies?", "lang": "en",
        "qtype": "lookup", "answerable": False, "gold_filenames": [], "gold_quotes": [],
        "group_names": [], "all_access": True, "must_not_retrieve": [],
    }])
    assert load_golden(path)[0].answerable is False


def test_answerable_question_without_gold_is_rejected(tmp_path):
    path = _write(tmp_path, [{
        "id": "q3", "question": "x", "lang": "en", "qtype": "lookup", "answerable": True,
        "gold_filenames": [], "gold_quotes": [], "group_names": [], "all_access": True,
        "must_not_retrieve": [],
    }])
    with pytest.raises(ValueError, match="line 1"):
        load_golden(path)

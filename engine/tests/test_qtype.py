import pytest

from app.ask.qtype import classify_question


@pytest.mark.parametrize(
    "q,expected",
    [
        ("How many contracts expire in Q3?", "aggregate"),
        ("Сколько договоров истекает в третьем квартале?", "aggregate"),
        ("What is the total headcount in Finance?", "aggregate"),
        ("List every policy that mentions data retention", "enumerate"),
        ("Перечислите все документы о выплатах", "enumerate"),
        ("Compare the 2025 and 2026 travel policies", "comparison"),
        ("В чём разница между версиями политики?", "comparison"),
        ("What is the data retention period?", "lookup"),
        ("Каков срок хранения данных?", "lookup"),
    ],
)
def test_classify(q, expected):
    assert classify_question(q) == expected


def test_empty_question_is_lookup():
    assert classify_question("") == "lookup"

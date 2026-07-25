import re

# Deterministic on purpose: this label drives a governance statistic (what share of
# real traffic needs computation rather than passage retrieval), and an LLM call on
# the ask path for a statistic is neither auditable nor affordable. Rules are
# checked most-specific first. Multilingual because the pilot corpus is RU/UZ/EN.

_AGGREGATE = re.compile(
    r"\b(how many|how much|count|total|sum|average|number of)\b"
    r"|\b(сколько|количество|общая сумма|в среднем|итого)\b"
    r"|\b(nechta|qancha|jami|o'rtacha)\b",
    re.IGNORECASE,
)
_ENUMERATE = re.compile(
    r"\b(list all|list every|list the|show all|which documents|all documents|every)\b"
    r"|\b(перечисл\w*|список|все документы|какие документы)\b"
    r"|\b(ro'yxat|barcha hujjatlar|hammasi)\b",
    re.IGNORECASE,
)
_COMPARISON = re.compile(
    r"\b(compare|difference between|versus|vs\.?|changed between|what changed)\b"
    r"|\b(сравн\w*|разница между|отличие|чем отличается|что изменилось)\b"
    r"|\b(taqqosla\w*|farqi|nima o'zgardi)\b",
    re.IGNORECASE,
)


def classify_question(text: str) -> str:
    """One of: aggregate | enumerate | comparison | lookup."""
    q = (text or "").strip()
    if not q:
        return "lookup"
    if _AGGREGATE.search(q):
        return "aggregate"
    if _ENUMERATE.search(q):
        return "enumerate"
    if _COMPARISON.search(q):
        return "comparison"
    return "lookup"

"""Golden-set records for retrieval evaluation.

Gold is expressed as (filename, verbatim quote), NOT chunk ids. Chunk ids change
every time chunking changes — and Phases 3 and 4 change it deliberately — so a set
keyed on them would be worthless the day it was needed. Filenames and quotes are
stable across re-ingest, re-chunking and re-embedding.
"""

import json
from dataclasses import dataclass


@dataclass
class GoldenQuestion:
    id: str
    question: str
    lang: str                     # "en" | "ru" | "uz"
    qtype: str                    # lookup | comparison | aggregate | enumerate
    answerable: bool
    gold_filenames: list[str]
    gold_quotes: list[str]
    group_names: list[str]        # the principal's access groups
    all_access: bool              # True = ask as an owner
    must_not_retrieve: list[str]  # filenames this principal must never see


_REQUIRED = (
    "id", "question", "lang", "qtype", "answerable", "gold_filenames",
    "gold_quotes", "group_names", "all_access", "must_not_retrieve",
)


def load_golden(path: str) -> list[GoldenQuestion]:
    out: list[GoldenQuestion] = []
    with open(path, encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, start=1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f"line {lineno}: invalid JSON: {e}") from e
            missing = [k for k in _REQUIRED if k not in rec]
            if missing:
                raise ValueError(f"line {lineno}: missing keys {missing}")
            if rec["answerable"] and not (rec["gold_filenames"] and rec["gold_quotes"]):
                raise ValueError(
                    f"line {lineno}: an answerable question needs at least one gold filename "
                    "and one gold quote, otherwise it scores zero forever and silently drags "
                    "every reported metric down"
                )
            out.append(GoldenQuestion(**{k: rec[k] for k in _REQUIRED}))
    return out

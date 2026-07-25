import json
import os

import psycopg
import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")

# (index name, the query it must serve). Planner choice depends on table size, so
# these run with enable_seqscan off: the assertion is that the index EXISTS and is
# APPLICABLE to the query, which is what silently regresses when a WHERE clause
# or an index definition drifts.
CASES = [
    (
        "chunks_doc_ordinal_idx",
        "SELECT text FROM chunks WHERE workspace_id='00000000-0000-0000-0000-000000000000' "
        "AND document_id='00000000-0000-0000-0000-000000000000' AND ordinal BETWEEN 0 AND 2 "
        "ORDER BY ordinal",
    ),
    (
        "citations_chunk_idx",
        "SELECT id FROM citations WHERE chunk_id='00000000-0000-0000-0000-000000000000'",
    ),
    (
        "document_groups_group_idx",
        "SELECT document_id FROM document_groups "
        "WHERE group_id='00000000-0000-0000-0000-000000000000'",
    ),
]


@pytest.mark.parametrize("index_name,query", CASES)
def test_index_exists_and_is_applicable(index_name, query):
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("SET LOCAL enable_seqscan = off")
            plan = conn.execute(f"EXPLAIN (FORMAT JSON) {query}").fetchone()[0]
    assert index_name in json.dumps(plan), f"{index_name} not used by:\n{query}\nplan: {plan}"

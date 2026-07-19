from app.graph.label import label_cluster


def test_fallback_uses_keywords_deterministically():
    assert label_cluster(["finance", "invoice"], ["Q3.pdf"]) == "Finance · Invoice"
    assert label_cluster([], []) == "Untitled topic"


def test_llm_label_is_used_and_trimmed():
    calls = []

    def fake_call(prompt: str) -> str:
        calls.append(prompt)
        return '  "Vendor Contracts"\n'

    out = label_cluster(["contract", "vendor"], ["msa.pdf"], call=fake_call)
    assert out == "Vendor Contracts"
    assert "contract" in calls[0]  # keywords fed to the model

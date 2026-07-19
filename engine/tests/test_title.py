from app.ask.title import generate_title


def test_fallback_truncates_on_a_word_boundary():
    text = "This is a fairly long first message that should get truncated somewhere sane"
    out = generate_title(text)
    assert len(out) <= 48
    assert not out.endswith(" ")


def test_fallback_returns_short_text_unchanged():
    assert generate_title("hi there") == "hi there"


def test_llm_title_is_used_and_sanitized():
    calls = []

    def fake_call(prompt: str) -> str:
        calls.append(prompt)
        return '  "Vendor Contract Renewal"\n'

    out = generate_title("Can you review the vendor contract?", call=fake_call)
    assert out == "Vendor Contract Renewal"
    assert "vendor contract" in calls[0].lower()


def test_call_failure_falls_back_without_crashing():
    def boom(_prompt: str) -> str:
        raise RuntimeError("model down")

    out = generate_title("hi there", call=boom)
    assert out == "hi there"


def test_whitespace_only_reply_falls_back_without_crashing():
    out = generate_title("hi there", call=lambda _p: "   ")
    assert out == "hi there"

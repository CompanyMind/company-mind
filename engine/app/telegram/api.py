import httpx

BASE = "https://api.telegram.org/bot{token}/{method}"


def call(token: str, method: str, params: dict | None = None, timeout: float = 30) -> dict:
    r = httpx.post(BASE.format(token=token, method=method), json=params or {}, timeout=timeout)
    r.raise_for_status()
    return r.json()


def get_me(token: str) -> dict:
    return call(token, "getMe")


def send_message(token: str, chat_id: int, text: str, parse_mode: str | None = None) -> None:
    params = {"chat_id": chat_id, "text": text}
    if parse_mode:
        params["parse_mode"] = parse_mode
        params["disable_web_page_preview"] = True
    call(token, "sendMessage", params)


def get_updates(token: str, offset: int | None, timeout: int = 20) -> list[dict]:
    res = call(token, "getUpdates", {"offset": offset, "timeout": timeout}, timeout=timeout + 10)
    return res.get("result", [])

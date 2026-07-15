from __future__ import annotations

import json
import urllib.parse


USER_AGENT = "CivitaiManager/1.0"


def request_headers(api_key: str | None = None, json_content: bool = True) -> dict[str, str]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json" if json_content else "*/*",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def http_error_message(body: str, fallback: str) -> str:
    if body:
        try:
            data = json.loads(body)
            if isinstance(data, dict):
                return str(data.get("error") or data.get("message") or data.get("detail") or fallback)
        except Exception:
            pass
    return fallback


def validate_civitai_https(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False
    host = parsed.netloc.lower()
    return parsed.scheme == "https" and (
        host == "civitai.com"
        or host == "www.civitai.com"
        or host == "civitai.red"
        or host.endswith(".civitai.red")
        or host.endswith(".civitai.com")
    )

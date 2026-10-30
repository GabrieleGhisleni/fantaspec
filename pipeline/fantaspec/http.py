import time

import requests

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)
TIMEOUT = 30  # seconds
ATTEMPTS = 3
BACKOFF = 2  # seconds before the second attempt, doubled before each later one


def _get_once(url: str) -> requests.Response:
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    response.raise_for_status()
    return response


def _get(url: str) -> requests.Response:
    for attempt in range(ATTEMPTS - 1):
        try:
            return _get_once(url)
        except requests.RequestException:
            time.sleep(BACKOFF * 2**attempt)
    return _get_once(url)  # last attempt: let the error propagate


def fetch_text(url: str) -> str:
    return _get(url).text


def fetch_json(url: str) -> dict:
    return _get(url).json()

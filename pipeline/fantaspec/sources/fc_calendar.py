import re
from collections.abc import Collection

from bs4 import BeautifulSoup

from fantaspec.clubs import by_key
from fantaspec.models import CalendarFixture

_MATCH_HREF = re.compile(r"calendario/(\d+)/[^/]+/([^/]+)/\d+$")


def parse_calendar(html: str, matchday: int) -> list[CalendarFixture]:
    """fantacalcio.it calendar page -> the fixtures of `matchday`, in page order, without duplicates."""
    keys = by_key().keys()
    fixtures: list[CalendarFixture] = []
    for link in BeautifulSoup(html, "html.parser").find_all("a", href=True):
        match = _MATCH_HREF.search(link["href"])
        if match is None or int(match.group(1)) != matchday:
            continue
        pair = _split_pair(match.group(2), keys)
        if pair is None:
            continue
        fixture = CalendarFixture(matchday, *pair)
        if fixture not in fixtures:
            fixtures.append(fixture)
    return fixtures


def _split_pair(slug: str, keys: Collection[str]) -> tuple[str, str] | None:
    """'<home>-<away>' -> (home, away), trying every club key as the prefix (keys may contain '-')."""
    for home in keys:
        away = slug.removeprefix(f"{home}-")
        if away != slug and away in keys:
            return home, away
    return None

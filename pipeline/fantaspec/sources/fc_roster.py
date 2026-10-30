import re

from bs4 import BeautifulSoup, Tag

from fantaspec.models import RosterPlayer

_PLAYER_HREF = re.compile(r"/serie-a/squadre/([^/]+)/[^/]+/(\d+)$")


def parse_player_link(row: Tag) -> tuple[int, str, str] | None:
    """The `a.player-name` link inside a row -> (player id, name, club slug), or None if absent."""
    link = row.select_one("a.player-name[href]")
    match = _PLAYER_HREF.search(link["href"]) if link else None
    if match is None:
        return None
    return int(match.group(2)), link.get_text(strip=True), match.group(1)


def parse_roster(html: str) -> list[RosterPlayer]:
    """fantacalcio.it quotazioni page -> every listed player with their Classic role."""
    players = []
    for row in BeautifulSoup(html, "html.parser").select("tr[data-filter-role-classic]"):
        link = parse_player_link(row)
        if link is None:
            continue
        player_id, name, club = link
        players.append(RosterPlayer(player_id, name, club, row["data-filter-role-classic"].upper()))
    return players

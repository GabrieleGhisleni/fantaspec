import re

from bs4 import BeautifulSoup, Tag

from fantaspec.models import LineupEntry
from fantaspec.sources.fc_roster import parse_player_link

_CLUB_HREF = re.compile(r"/serie-a/squadre/([^/]+)$")
_PERCENT = re.compile(r"(\d{1,3})%")


def parse_lineups(html: str) -> tuple[list[LineupEntry], set[str]]:
    """fantacalcio.it probable lineups page -> (starters and bench of every match, the clubs of those matches).

    A player named in one of the match's "ballottaggi" is doubtful.
    Raises ValueError when a match block doesn't look as expected.
    """
    matches = BeautifulSoup(html, "html.parser").select("li.match-item")
    if not matches:
        raise ValueError("lineups page: no match blocks")
    entries: list[LineupEntry] = []
    clubs: set[str] = set()
    for match in matches:
        pair = _match_clubs(match)
        clubs.update(pair)
        doubtful = {link[0] for li in match.select(".ballot-list li") if (link := parse_player_link(li))}
        for item in match.select(".team-card .player-list li.player-item"):
            entry = _entry(item, doubtful)
            if entry.club not in pair:
                raise ValueError(f"lineups page: {entry.name} ({entry.club}) listed in {pair[0]}-{pair[1]}")
            entries.append(entry)
    return entries, clubs


def _match_clubs(match: Tag) -> tuple[str, str]:
    """The (home, away) club slugs from a match block's header."""
    slugs = []
    for side in ("team-home", "team-away"):
        link = match.select_one(f"label.{side} a.team-link[href]")
        found = _CLUB_HREF.search(link["href"]) if link else None
        if found is None:
            raise ValueError(f"lineups page: no {side} club in match {match.get('id')}")
        slugs.append(found.group(1))
    return slugs[0], slugs[1]


def _entry(item: Tag, doubtful: set[int]) -> LineupEntry:
    """One starter or bench row (name link + "NN%") -> LineupEntry."""
    link = parse_player_link(item)
    value = item.select_one(".progress-value")
    percent = _PERCENT.fullmatch(value.get_text(strip=True)) if value else None
    if link is None or percent is None or int(percent.group(1)) > 100:
        raise ValueError(f"lineups page: unexpected player row {item.get_text(' ', strip=True)!r}")
    player_id, name, club = link
    return LineupEntry(player_id, name, club, int(percent.group(1)), player_id in doubtful)

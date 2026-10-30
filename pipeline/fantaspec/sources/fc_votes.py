from bs4 import BeautifulSoup, Tag

from fantaspec.models import VoteRow
from fantaspec.sources.fc_roster import parse_player_link

# fantacalcio.it encodes "s.v." (senza voto) as this grade value.
_SENZA_VOTO = 55.0

_BONUS_FIELDS = {
    "Gol segnati": "goals",
    "Gol subiti": "conceded",
    "Autoreti": "own_goals",
    "Rigori segnati": "pens_scored",
    "Rigori sbagliati": "pens_missed",
    "Rigori parati": "pens_saved",
    "Assist": "assists",
}


def parse_votes(html: str, matchday: int) -> list[VoteRow]:
    """fantacalcio.it votes page -> one VoteRow per player (coaches are skipped).

    The vote pair is the first of the three (Redazione Fantacalcio).
    """
    rows = []
    for tr in BeautifulSoup(html, "html.parser").find_all("tr"):
        link = parse_player_link(tr)
        if link is None:
            continue
        player_id, name, club = link
        pill = tr.select_one(".pill")
        bonus = {cell.get("title"): cell["data-value"] for cell in tr.select(".player-bonus[data-value]")}
        rows.append(
            VoteRow(
                player_id=player_id,
                name=name,
                club=club,
                role=tr.select_one("span.role[data-value]")["data-value"].upper(),
                matchday=matchday,
                vote=_grade(pill.select_one(".player-grade")),
                fanta_vote=_grade(pill.select_one(".player-fanta-grade")),
                **{field: int(bonus[title]) for title, field in _BONUS_FIELDS.items()},
            )
        )
    return rows


def _grade(cell: Tag | None) -> float | None:
    """A grade cell's comma-decimal data-value -> float; None for s.v. or anything non-numeric."""
    try:
        value = float(cell["data-value"].replace(",", "."))
    except (TypeError, KeyError, ValueError):
        return None
    return None if value == _SENZA_VOTO else value

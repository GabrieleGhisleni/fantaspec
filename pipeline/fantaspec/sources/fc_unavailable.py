from bs4 import BeautifulSoup, Tag

from fantaspec.clubs import load_clubs
from fantaspec.models import Unavailable

# List heading -> Unavailable.kind
_KINDS = {"Infortunati": "injured", "Squalificati": "suspended", "Diffidati": "warned"}


def parse_unavailable(html: str) -> list[Unavailable]:
    """fantacalcio.it unavailable page -> every injured, suspended and warned player, club by club.

    Each club card holds headed lists; an empty list is a "Nessuno" message instead of a list.
    Raises ValueError on an unknown club, heading or element.
    """
    club_keys = {c.name.lower(): c.key for c in load_clubs()}
    cards = BeautifulSoup(html, "html.parser").select("div.card.team-card")
    if not cards:
        raise ValueError("unavailable page: no club sections")
    items: list[Unavailable] = []
    for card in cards:
        club_name = card.select_one(".team-name").get_text(strip=True)
        club = club_keys.get(club_name.lower())
        if club is None:
            raise ValueError(f"unavailable page: unknown club {club_name!r}")
        for column in card.select(".col"):
            items.extend(_column(column, club))
    return items


def _column(column: Tag, club: str) -> list[Unavailable]:
    """A column of the club card: heading, list or empty message, heading, ..."""
    items = []
    kind = None
    for child in column.find_all(recursive=False):
        text = child.get_text(" ", strip=True)
        if child.name == "header":
            kind = next((k for heading, k in _KINDS.items() if heading in text), None)
            if kind is None:
                raise ValueError(f"unavailable page: unknown heading {text!r} ({club})")
        elif kind and child.name == "ul":
            items.extend(_entry(li, club, kind) for li in child.find_all("li", recursive=False))
        elif not (kind and "empty-list-message" in child.get("class", []) and text.startswith("Nessun")):
            raise ValueError(f"unavailable page: unexpected element {text[:60]!r} ({club})")
    return items


def _entry(li: Tag, club: str, kind: str) -> Unavailable:
    """One list item: the player's name and an optional note."""
    name = li.select_one(".item-name")
    if name is None:
        raise ValueError(f"unavailable page: list item without a name ({club})")
    note = li.select_one(".item-description")
    text = " ".join(note.get_text(" ", strip=True).split()) if note else ""
    return Unavailable(club, name.get_text(strip=True), kind, text)

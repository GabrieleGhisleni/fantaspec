import unicodedata

from fantaspec.models import RosterPlayer

_APOSTROPHES = str.maketrans({"’": "'", "‘": "'", "ʼ": "'", "`": "'", "´": "'"})


def normalise(name: str) -> str:
    """Lower case, no accents, one kind of apostrophe, no dots, single spaces: "Konè M." -> "kone m"."""
    decomposed = unicodedata.normalize("NFKD", name.translate(_APOSTROPHES).lower())
    plain = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return " ".join(plain.replace(".", "").split())


def _surname(name: str) -> str:
    """The normalised name without its initials: "Martinez Jo." -> "martinez"."""
    return normalise(" ".join(word for word in name.split() if not word.endswith(".")))


def match_player(name: str, club: str, roster: list[RosterPlayer]) -> int | None:
    """The roster id of the player called `name` at `club`: an exact normalised match first,
    then a unique surname match; None when no player or more than one fits."""
    candidates = [p for p in roster if p.club == club]
    for key in (normalise, _surname):
        target = key(name)
        hits = [p.id for p in candidates if key(p.name) == target] if target else []
        if hits:
            return hits[0] if len(hits) == 1 else None
    return None

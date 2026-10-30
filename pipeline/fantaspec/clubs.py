import json
from importlib.resources import files

from fantaspec.models import Club


def load_clubs() -> list[Club]:
    rows = json.loads(files("fantaspec").joinpath("clubs.json").read_text(encoding="utf-8"))
    return [Club(key=r["key"], name=r["name"], espn_id=r["espn_id"]) for r in rows]


def by_espn() -> dict[int, Club]:
    return {c.espn_id: c for c in load_clubs()}


def by_key() -> dict[str, Club]:
    return {c.key: c for c in load_clubs()}

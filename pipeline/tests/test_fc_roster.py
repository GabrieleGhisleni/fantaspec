from conftest import load_fixture

from fantaspec.models import RosterPlayer
from fantaspec.sources.fc_roster import parse_roster


def test_roster():
    players = parse_roster(load_fixture("fc_roster.html.gz"))
    assert len(players) >= 500
    assert RosterPlayer(572, "Meret", "napoli", "P") in players
    assert {p.role for p in players} == {"P", "D", "C", "A"}

from conftest import load_fixture

from fantaspec.clubs import by_espn, load_clubs
from fantaspec.sources.espn import parse_teams


def test_clubs_mapping_complete():
    clubs = load_clubs()
    assert len(clubs) == 20
    assert len({c.espn_id for c in clubs}) == 20
    assert set(by_espn()) == set(parse_teams(load_fixture("espn_teams.json")))

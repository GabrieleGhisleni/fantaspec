import pytest
from conftest import load_fixture

from fantaspec.models import LineupEntry
from fantaspec.sources.fc_lineups import parse_lineups


def test_lineups_structure():
    entries, clubs = parse_lineups(load_fixture("fc_lineups.html.gz"))
    assert len(clubs) >= 18
    assert len(entries) >= 300
    assert all(0 <= e.start_pct <= 100 for e in entries)
    assert any(e.doubtful for e in entries)


def test_lineups_values():
    entries, clubs = parse_lineups(load_fixture("fc_lineups.html.gz"))
    assert {"bologna", "monza"} <= clubs
    assert LineupEntry(133, "Skorupski", "bologna", 90, False) in entries  # starter
    assert LineupEntry(7212, "Heggem", "bologna", 40, True) in entries  # bench, in a ballottaggio with Casale
    assert LineupEntry(5498, "Casale", "bologna", 60, True) in entries
    # De Silvestri is only in Bologna's injured list, not in the lineup
    assert not any(e.player_id == 487 for e in entries)
    assert len({e.player_id for e in entries}) == len(entries)


def test_lineups_rejects_unknown_markup():
    with pytest.raises(ValueError):
        parse_lineups("<html><body><p>Pagina non trovata</p></body></html>")

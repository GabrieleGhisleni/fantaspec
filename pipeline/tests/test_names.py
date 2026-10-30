from fantaspec.models import RosterPlayer
from fantaspec.names import match_player


def test_match_player():
    roster = [RosterPlayer(1, "Miranda J.", "bologna", "D"), RosterPlayer(2, "N'Dicka", "roma", "D"),
              RosterPlayer(3, "Martinez L.", "inter", "A"), RosterPlayer(4, "Martinez Jo.", "inter", "P")]
    assert match_player("Miranda J.", "bologna", roster) == 1
    assert match_player("N’Dicka", "roma", roster) == 2
    assert match_player("Lautaro Martinez", "inter", roster) is None
    assert match_player("Martinez L.", "inter", roster) == 3
    assert match_player("Miranda", "roma", roster) is None


def test_match_player_normalisation_and_surname():
    roster = [RosterPlayer(10, "Kessie", "atalanta", "C"), RosterPlayer(11, "Pellegrini Lo.", "roma", "C"),
              RosterPlayer(12, "Thuram", "juventus", "C")]
    assert match_player("KESSIÈ", "atalanta", roster) == 10
    assert match_player("Pellegrini", "roma", roster) == 11
    assert match_player("Thuram K.", "juventus", roster) == 12
    assert match_player("Miranda", "bologna", roster) is None

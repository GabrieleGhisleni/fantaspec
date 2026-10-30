from season import CAL, CLUBS, ESPN, utc

from fantaspec.fixtures import join_fixtures
from fantaspec.models import EspnMatch, Fixture


def test_join_keeps_unplayed_and_postponed():
    fx = join_fixtures(CAL, ESPN, CLUBS)
    assert len(fx) == len(CAL)
    postponed = next(f for f in fx if (f.home, f.away) == ("lazio", "roma"))
    assert postponed.matchday == 3 and postponed.completed is False


def test_join_takes_kickoff_and_score_from_espn():
    fx = join_fixtures(CAL, ESPN, CLUBS)
    assert [(f.matchday, f.home, f.away) for f in fx] == [(c.matchday, c.home, c.away) for c in CAL]
    assert Fixture(1, "napoli", "lazio", utc(2026, 9, 20, 16, 0), 2, 0, True) in fx
    assert Fixture(1, "roma", "torino", utc(2026, 10, 22, 18, 45), 0, 0, True) in fx       # played late
    assert Fixture(4, "juventus", "napoli", utc(2026, 10, 31, 17, 0), None, None, False) in fx
    assert Fixture(5, "lazio", "juventus", None, None, None, False) in fx                 # not on ESPN


def test_join_prefers_the_completed_copy_of_a_match():
    # torino-napoli as listed by a page fetched before the match, kept in raw/ when that page later failed
    stale = EspnMatch("e5", utc(2026, 10, 18, 16, 0), 239, 114, None, None, False)
    played = Fixture(3, "torino", "napoli", utc(2026, 10, 18, 16, 0), 2, 1, True)
    assert played in join_fixtures(CAL, ESPN + [stale], CLUBS)
    assert played in join_fixtures(CAL, [stale] + ESPN, CLUBS)

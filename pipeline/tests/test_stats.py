from season import (CAL, CLUBS, ESPN, HISTORY, LINEUPS, NOW, ROSTER, STANDINGS, UNAVAIL,
                    UNAVAIL_555_SUSPENDED, VOTES, utc)

from fantaspec.fixtures import join_fixtures
from fantaspec.models import Fixture
from fantaspec.stats import club_stats, player_stats

FX = join_fixtures(CAL, ESPN, CLUBS)


def test_club_stats_form_split_and_next():
    out = club_stats(FX, STANDINGS, HISTORY, CLUBS, now=NOW)
    nap = out["napoli"]
    assert nap["form"] == ["W", "D", "L"]            # oldest -> newest
    assert (nap["gf"], nap["ga"]) == (4, 3)
    assert nap["home"] == {"played": 2, "gf": 3, "ga": 1}
    assert nap["next"]["opponent"] == "juventus" and nap["next"]["home"] is False
    assert nap["next"]["h2h"] == ["L", "W", "D"]     # from napoli's side, history + this season
    assert out["torino"]["next"] is None             # no fixture left


def test_club_stats_full_object():
    out = club_stats(FX, STANDINGS, HISTORY, CLUBS, now=NOW)
    assert sorted(out) == ["juventus", "lazio", "napoli", "roma", "torino"]
    assert out["napoli"] == {
        "key": "napoli", "name": "Napoli", "position": 2, "points": 4, "played": 3,
        "form": ["W", "D", "L"], "gf": 4, "ga": 3,
        "home": {"played": 2, "gf": 3, "ga": 1}, "away": {"played": 1, "gf": 1, "ga": 2},
        "next": {"opponent": "juventus", "home": False, "kickoff": "2026-10-31T18:00:00+01:00", "matchday": 4,
                 "h2h": ["L", "W", "D"]}}
    assert out["juventus"]["next"]["home"] is True and out["juventus"]["next"]["h2h"] == ["W", "L", "D"]


def test_club_stats_postponed_and_late_matches():
    out = club_stats(FX, STANDINGS, HISTORY, CLUBS, now=NOW)
    # lazio-roma (matchday 3) was postponed and ESPN kept its past date: next is the real next match
    assert out["lazio"]["next"] == {"opponent": "roma", "home": False, "kickoff": "2026-11-01T20:45:00+01:00",
                                    "matchday": 4, "h2h": []}
    assert out["roma"]["next"]["opponent"] == "lazio" and out["roma"]["next"]["matchday"] == 4
    # roma-torino (matchday 1) was played after matchday 3: form follows kickoff, not matchday
    assert out["torino"]["form"] == ["W", "W", "D"]
    assert out["torino"]["away"] == {"played": 1, "gf": 0, "ga": 0}


def test_h2h_keeps_the_last_five_meetings():
    old = [Fixture(0, "juventus", "napoli", utc(2015 + i, 2, 1, 19, 45), i % 3, 1, True) for i in range(7)]
    nap = club_stats(FX, STANDINGS, old, CLUBS, now=NOW)["napoli"]
    # napoli W D L W D L W in 2015-2021, then D this season
    assert nap["next"]["h2h"] == ["W", "D", "L", "W", "D"]


def compute():
    return player_stats(ROSTER, VOTES, FX, LINEUPS, UNAVAIL, club_stats(FX, STANDINGS, HISTORY, CLUBS, now=NOW))


def test_player_stats_keeper_and_unvoted():
    out = compute()
    meret = out["572"]
    assert meret["season"]["pres"] == 3 and meret["season"]["medFV"] == 6.0
    assert meret["season"]["gs"] == 3 and meret["season"]["cs"] == 1
    assert meret["last5"]["fv"] == [7.0, 6.0, 5.0]
    bench = out["999"]                                # in roster, never voted
    assert bench["season"]["pres"] == 0 and bench["season"]["medV"] is None
    assert bench["last5"]["fv"] == [None, None, None] and bench["last5"]["played"] == 0
    assert out["123"]["season"]["g"] == 2             # 1 goal + 1 penalty
    assert out["123"]["season"]["cs"] is None         # role C


def test_player_status_and_start_pct():
    out = compute()
    assert out["572"]["startPct"] == 95
    assert out["888"]["startPct"] == 0               # club covered, player not listed
    assert out["777"]["startPct"] is None            # club not covered
    assert out["555"]["status"] == {"kind": "suspended", "text": UNAVAIL_555_SUSPENDED.text}   # also listed injured; suspended wins
    assert out["444"]["club"] is None                 # voted earlier, no longer in roster


def test_player_full_object_and_population():
    out = compute()
    assert sorted(out) == ["123", "321", "444", "555", "572", "666", "777", "888", "999"]
    assert out["572"] == {
        "id": 572, "name": "Meret", "club": "napoli", "role": "P",
        "season": {"pres": 3, "medV": 7.0, "medFV": 6.0, "g": 0, "gs": 3, "a": 0, "cs": 1},
        "last5": {"played": 3, "g": 0, "gs": 3, "a": 0, "fv": [7.0, 6.0, 5.0]},
        "status": None, "startPct": 95}


def test_player_sv_transfer_and_status_priority():
    out = compute()
    mct = out["123"]                                  # s.v. on matchday 2 doesn't count
    assert mct["season"] == {"pres": 2, "medV": 6.75, "medFV": 10.25, "g": 2, "gs": 0, "a": 1, "cs": None}
    assert mct["last5"] == {"played": 2, "g": 2, "gs": 0, "a": 1, "fv": [10.0, None, 10.5]}
    assert mct["status"] == {"kind": "doubtful", "text": ""}      # ballottaggio beats warned
    assert out["888"]["status"] == {"kind": "warned", "text": ""}
    bng = out["321"]                                  # matchday 2 for torino, clean sheet there
    assert bng["season"]["cs"] == 1
    assert bng["last5"]["fv"] == [None, 6.5, 5.5] and bng["last5"]["played"] == 2
    assert out["666"]["startPct"] is None             # club on the lineups page but no fixture left


def test_departed_player():
    rossi = compute()["444"]
    assert (rossi["name"], rossi["club"], rossi["role"]) == ("Rossi F.", None, "D")   # latest vote row
    assert rossi["season"]["pres"] == 2 and rossi["season"]["cs"] == 0
    assert rossi["last5"] == {"played": 0, "g": 0, "gs": 0, "a": 0, "fv": []}
    assert rossi["status"] is None and rossi["startPct"] is None


def test_lineups_page_counts_only_for_the_clubs_next_match():
    clubs_out = club_stats(FX, STANDINGS, HISTORY, CLUBS, now=NOW)
    out = compute()                                   # roma's played match (roma-torino) is on the page
    assert out["777"]["startPct"] is None and out["777"]["status"] is None
    stale = player_stats(ROSTER, VOTES, FX, (LINEUPS[0], {("lazio", "roma")}), [], clubs_out)   # postponed md 3
    assert stale["777"]["startPct"] is None and stale["777"]["status"] is None
    fresh = player_stats(ROSTER, VOTES, FX, (LINEUPS[0], {("roma", "lazio")}), [], clubs_out)   # roma's next
    assert fresh["777"]["startPct"] == 70 and fresh["777"]["status"] == {"kind": "doubtful", "text": ""}
    assert fresh["572"]["startPct"] is None and fresh["123"]["status"] is None

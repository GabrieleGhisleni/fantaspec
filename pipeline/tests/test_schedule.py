from datetime import date, datetime, timezone

from fantaspec.config import TZ
from fantaspec.models import Fixture
from fantaspec.schedule import Slot, due, slots


def rome(*args: int) -> datetime:
    return datetime(*args, tzinfo=TZ)


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


def match(matchday: int, home: str, away: str, kickoff: datetime | None) -> Fixture:
    """An unplayed fixture; the kickoff is stored in UTC, as ESPN gives it."""
    return Fixture(matchday, home, away, kickoff.astimezone(timezone.utc) if kickoff else None, None, None, False)


ROUND_10_AND_11 = [
    match(10, "lecce", "como", rome(2026, 10, 31, 15, 0)),             # Sat 31 Oct
    match(10, "juventus", "napoli", rome(2026, 10, 31, 18, 0)),
    match(10, "inter", "fiorentina", rome(2026, 10, 31, 20, 45)),
    match(10, "genoa", "venezia", rome(2026, 11, 1, 12, 30)),          # Sun 1 Nov
    match(10, "parma", "udinese", rome(2026, 11, 1, 15, 0)),
    match(10, "torino", "monza", rome(2026, 11, 1, 15, 0)),
    match(10, "atalanta", "milan", rome(2026, 11, 1, 18, 0)),
    match(10, "roma", "lazio", rome(2026, 11, 1, 20, 45)),
    match(10, "cagliari", "sassuolo", rome(2026, 11, 2, 18, 30)),      # Mon 2 Nov
    match(10, "bologna", "frosinone", rome(2026, 11, 2, 20, 45)),
    match(11, "napoli", "roma", rome(2026, 11, 7, 18, 0)),             # Sat 7 Nov
    match(11, "milan", "inter", rome(2026, 11, 7, 20, 45)),
    match(11, "lazio", "juventus", rome(2026, 11, 8, 15, 0)),          # Sun 8 Nov
]

ROUND_8_SUN_25_OCT = [
    match(8, "napoli", "inter", rome(2026, 10, 25, 12, 30)),
    match(8, "roma", "milan", rome(2026, 10, 25, 15, 0)),
    match(8, "juventus", "lazio", rome(2026, 10, 25, 18, 0)),
    match(8, "atalanta", "bologna", rome(2026, 10, 25, 20, 45)),
]

ROUND_9_WED_28_OCT = [
    match(9, "inter", "roma", rome(2026, 10, 28, 18, 30)),
    match(9, "milan", "napoli", rome(2026, 10, 28, 20, 45)),
    match(9, "lazio", "atalanta", rome(2026, 10, 28, 20, 45)),
]


def test_slots_for_a_normal_week():
    s = slots(ROUND_10_AND_11)
    window = [x for x in s if date(2026, 10, 29) <= x.at.date() <= date(2026, 11, 7)]
    assert len(window) == 18
    assert Slot(rome(2026, 10, 29, 9, 0), "light") in window
    assert Slot(rome(2026, 10, 31, 23, 30), "full") in window
    assert Slot(rome(2026, 11, 3, 12, 0), "full") in window
    assert Slot(rome(2026, 11, 4, 12, 0), "full") in window
    assert not any(x.at.date() == date(2026, 11, 4) and x.at.hour != 12 for x in window)


def test_due_with_delay_and_dst():
    s = slots(ROUND_10_AND_11)
    assert due(utc(2026, 10, 31, 23, 7), s).at == rome(2026, 10, 31, 23, 30)   # 23:30 CET = 22:30 UTC, 37 min late
    assert due(utc(2026, 11, 1, 0, 7), s) is None                               # 97 min late, outside grace
    assert due(utc(2026, 11, 4, 20, 7), s) is None                              # quiet evening


def test_midweek_round_overlap_and_dst():
    s = slots(ROUND_8_SUN_25_OCT + ROUND_9_WED_28_OCT)
    assert Slot(rome(2026, 10, 26, 9, 0), "light") in s and Slot(rome(2026, 10, 26, 12, 0), "full") in s
    assert due(utc(2026, 10, 24, 17, 7), s).at == rome(2026, 10, 24, 19, 0)    # Sat 24: CEST, 19:00 = 17:00 UTC
    assert due(utc(2026, 10, 25, 9, 7), s).at == rome(2026, 10, 25, 10, 0)     # Sun 25: CET after the switch, 10:00 = 09:00 UTC


def test_slots_use_the_local_date_and_skip_matches_without_kickoff():
    s = slots([match(12, "lazio", "roma", utc(2026, 11, 21, 23, 30)),          # 00:30 on Sun 22 Nov in Rome
               match(12, "milan", "inter", None)])                              # not on ESPN yet
    assert s == [
        Slot(rome(2026, 11, 20, 9, 0), "light"), Slot(rome(2026, 11, 20, 19, 0), "light"),
        Slot(rome(2026, 11, 21, 9, 0), "light"), Slot(rome(2026, 11, 21, 19, 0), "light"),
        Slot(rome(2026, 11, 22, 10, 0), "light"), Slot(rome(2026, 11, 22, 23, 30), "full"),
        Slot(rome(2026, 11, 23, 12, 0), "full"),
        Slot(rome(2026, 11, 24, 12, 0), "full"),
    ]

"""A small hand-built season shared by test_fixtures and test_stats.

Five clubs; Lazio-Roma (matchday 3) postponed with ESPN keeping its original date; Roma-Torino
(matchday 1) played late, after matchday 3; Lazio-Juventus (matchday 5) not on ESPN yet.
"""
from datetime import datetime, timezone

from fantaspec.config import TZ
from fantaspec.models import (CalendarFixture, Club, EspnMatch, Fixture, LineupEntry, RosterPlayer,
                              StandingRow, Unavailable, VoteRow)


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


def vote(pid: int, name: str, club: str, role: str, md: int, v: float | None, fv: float | None,
         goals: int = 0, conceded: int = 0, pens: int = 0, assists: int = 0) -> VoteRow:
    return VoteRow(pid, name, club, role, md, v, fv, goals, conceded, 0, pens, 0, 0, assists)


NOW = datetime(2026, 10, 30, 12, 0, tzinfo=TZ)

CLUBS = [Club("juventus", "Juventus", 111), Club("lazio", "Lazio", 112), Club("napoli", "Napoli", 114),
         Club("roma", "Roma", 104), Club("torino", "Torino", 239)]

CAL = [
    CalendarFixture(1, "napoli", "lazio"), CalendarFixture(1, "roma", "torino"),
    CalendarFixture(2, "napoli", "juventus"), CalendarFixture(2, "torino", "lazio"),
    CalendarFixture(3, "torino", "napoli"), CalendarFixture(3, "lazio", "roma"),
    CalendarFixture(4, "juventus", "napoli"), CalendarFixture(4, "roma", "lazio"),
    CalendarFixture(5, "lazio", "juventus"),
]

ESPN = [
    EspnMatch("e1", utc(2026, 9, 20, 16, 0), 114, 112, 2, 0, True),             # napoli-lazio
    EspnMatch("e2", utc(2026, 10, 22, 18, 45), 104, 239, 0, 0, True),           # roma-torino, played late
    EspnMatch("e3", utc(2026, 10, 4, 18, 45), 114, 111, 1, 1, True),            # napoli-juventus
    EspnMatch("e4", utc(2026, 10, 4, 13, 0), 239, 112, 1, 0, True),             # torino-lazio
    EspnMatch("e5", utc(2026, 10, 18, 16, 0), 239, 114, 2, 1, True),            # torino-napoli
    EspnMatch("e6", utc(2026, 10, 18, 18, 45), 112, 104, None, None, False),    # lazio-roma, postponed
    EspnMatch("e7", utc(2026, 10, 31, 17, 0), 111, 114, None, None, False),     # juventus-napoli
    EspnMatch("e8", utc(2026, 11, 1, 19, 45), 104, 112, None, None, False),     # roma-lazio
    EspnMatch("e5", utc(2026, 10, 18, 16, 0), 239, 114, 2, 1, True),            # again, from Napoli's schedule
    EspnMatch("e9", utc(2026, 9, 27, 13, 0), 114, 103, 3, 0, True),             # vs Milan, not in CLUBS
]

STANDINGS = [StandingRow(239, 1, 7, 3), StandingRow(114, 2, 4, 3), StandingRow(111, 3, 1, 1),
             StandingRow(104, 4, 1, 1), StandingRow(112, 5, 0, 2)]

HISTORY = [
    Fixture(0, "napoli", "juventus", utc(2025, 9, 28, 18, 45), 3, 1, True),
    Fixture(0, "juventus", "napoli", utc(2025, 1, 5, 19, 45), 2, 0, True),      # older, listed second
    Fixture(0, "napoli", "lazio", utc(2025, 3, 1, 17, 0), 1, 0, True),
]

ROSTER = [
    RosterPlayer(572, "Meret", "napoli", "P"),
    RosterPlayer(999, "Contini", "napoli", "P"),                 # never voted
    RosterPlayer(123, "McTominay", "napoli", "C"),
    RosterPlayer(321, "Buongiorno", "napoli", "D"),              # came from Torino after matchday 2
    RosterPlayer(555, "Vlahovic", "juventus", "A"),
    RosterPlayer(888, "Locatelli", "juventus", "C"),
    RosterPlayer(777, "Dybala", "roma", "A"),
    RosterPlayer(666, "Milinkovic-Savic V.", "torino", "P"),
]

VOTES = [
    vote(572, "Meret", "napoli", "P", 1, 6.0, 7.0),
    vote(572, "Meret", "napoli", "P", 2, 7.0, 6.0, conceded=1),
    vote(572, "Meret", "napoli", "P", 3, 7.0, 5.0, conceded=2),
    vote(123, "McTominay", "napoli", "C", 1, 7.0, 10.0, goals=1),
    vote(123, "McTominay", "napoli", "C", 2, None, None),                       # s.v.
    vote(123, "McTominay", "napoli", "C", 3, 6.5, 10.5, pens=1, assists=1),
    vote(321, "Buongiorno", "torino", "D", 2, 6.5, 6.5),
    vote(321, "Buongiorno", "napoli", "D", 3, 6.0, 5.5),
    vote(555, "Vlahovic", "juventus", "A", 2, 6.0, 6.0),
    vote(888, "Locatelli", "juventus", "C", 2, 6.5, 6.5),
    vote(444, "Rossi F.", "lazio", "D", 2, 5.5, 5.0),                           # left Serie A after this
    vote(444, "Rossi", "lazio", "D", 1, 5.0, 4.5),
]

LINEUPS = ([LineupEntry(572, "Meret", "napoli", 95, False),
            LineupEntry(321, "Buongiorno", "napoli", 90, False),
            LineupEntry(123, "McTominay", "napoli", 55, True),
            LineupEntry(666, "Milinkovic-Savic V.", "torino", 90, False)],
           {"napoli", "juventus", "torino"})

UNAVAIL_555_SUSPENDED = Unavailable("juventus", "Vlahovic D.", "suspended", "squalificato per una giornata")
UNAVAIL = [
    Unavailable("juventus", "Vlahovic", "injured", "rientro a metà novembre"),
    UNAVAIL_555_SUSPENDED,
    Unavailable("napoli", "McTominay", "warned", ""),
    Unavailable("juventus", "Locatelli", "warned", ""),
    Unavailable("napoli", "Sconosciuto", "injured", "stagione finita"),         # not on the roster
]

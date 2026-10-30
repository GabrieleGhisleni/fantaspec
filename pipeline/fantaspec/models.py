from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Club:
    key: str  # fantacalcio.it club slug, e.g. "napoli"
    name: str  # Italian display name
    espn_id: int


@dataclass(frozen=True)
class EspnMatch:
    espn_id: str
    kickoff: datetime  # UTC
    home_espn: int
    away_espn: int
    home_goals: int | None  # None unless completed
    away_goals: int | None
    completed: bool


@dataclass(frozen=True)
class StandingRow:
    espn_id: int
    position: int
    points: int
    played: int


@dataclass(frozen=True)
class VoteRow:
    player_id: int  # fantacalcio.it player id
    name: str
    club: str  # fantacalcio.it club slug
    role: str  # P, D, C or A
    matchday: int
    vote: float | None  # None when s.v.
    fanta_vote: float | None
    goals: int  # open-play goals only; penalties are in pens_scored
    conceded: int
    own_goals: int
    pens_scored: int
    pens_missed: int
    pens_saved: int
    assists: int


@dataclass(frozen=True)
class RosterPlayer:
    id: int  # fantacalcio.it player id
    name: str
    club: str  # fantacalcio.it club slug
    role: str  # P, D, C or A


@dataclass(frozen=True)
class CalendarFixture:
    matchday: int
    home: str  # fantacalcio.it club slug
    away: str


@dataclass(frozen=True)
class LineupEntry:
    player_id: int  # fantacalcio.it player id
    name: str
    club: str  # fantacalcio.it club slug
    start_pct: int  # 0-100, chance of starting
    doubtful: bool  # named in a "ballottaggio" (two-way doubt for a starting spot)


@dataclass(frozen=True)
class Unavailable:
    club: str  # fantacalcio.it club slug
    name: str  # as written on the page; matched to a roster id by names.match_player
    kind: str  # injured, suspended or warned
    text: str  # the page's note, "" when there is none


@dataclass(frozen=True)
class Fixture:
    matchday: int  # 0 for a past season's match (head to head only)
    home: str  # fantacalcio.it club slug
    away: str
    kickoff: datetime | None  # UTC; None when ESPN doesn't list the match
    home_goals: int | None  # None unless completed
    away_goals: int | None
    completed: bool

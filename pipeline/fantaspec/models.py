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

"""Update slots: the Europe/Rome times at which the hourly workflow does a run, and the gate."""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from fantaspec.config import TZ
from fantaspec.models import Fixture

LIGHT = "light"
FULL = "full"

_DAY = timedelta(days=1)


@dataclass(frozen=True)
class Slot:
    at: datetime  # aware, Europe/Rome
    kind: str  # light or full


def slots(fixtures: list[Fixture]) -> list[Slot]:
    """Every update slot of the season, sorted, one per time (full wins over light).

    Dates are local to Europe/Rome; fixtures without a kickoff are ignored.
    - each match day: 10:00 light and 23:30 full;
    - the two days before a matchday's first match day: 09:00 and 19:00 light, unless they are match days;
    - after a match day: the next day at 12:00 full, and the day after that too, while both are free.
    """
    match_days: set[date] = set()
    first_day: dict[int, date] = {}
    for f in fixtures:
        if f.kickoff is None:
            continue
        d = f.kickoff.astimezone(TZ).date()
        match_days.add(d)
        first_day[f.matchday] = min(d, first_day.get(f.matchday, d))

    kinds: dict[datetime, str] = {}

    def add(d: date, t: time, kind: str) -> None:
        at = datetime.combine(d, t, tzinfo=TZ)
        if kinds.get(at) != FULL:
            kinds[at] = kind

    for d in match_days:
        add(d, time(10, 0), LIGHT)
        add(d, time(23, 30), FULL)
        if d + _DAY not in match_days:
            add(d + _DAY, time(12, 0), FULL)
            if d + 2 * _DAY not in match_days:
                add(d + 2 * _DAY, time(12, 0), FULL)
    for first in first_day.values():
        for d in (first - 2 * _DAY, first - _DAY):
            if d not in match_days:
                add(d, time(9, 0), LIGHT)
                add(d, time(19, 0), LIGHT)

    return [Slot(at, kind) for at, kind in sorted(kinds.items())]


def due(now: datetime, slots: list[Slot], grace: timedelta = timedelta(minutes=90)) -> Slot | None:
    """The slot an hourly trigger at `now` (aware) should run: the latest one that started less
    than `grace` ago, so a late trigger still runs it. None outside every slot."""
    started = [s for s in slots if timedelta(0) <= now - s.at < grace]
    return max(started, key=lambda s: s.at, default=None)

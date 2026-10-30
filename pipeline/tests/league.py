"""A made-up 20-club season around NOW (Friday 30 Oct 2026, 12:00 in Rome) for the run tests, the raw/
files a previous run would have left, and a fake fetcher that serves the season.

Real clubs in a double round robin, with Lazio-Roma on matchday 3. Matchdays 1-9 were played one a week up
to Wednesday 28 Oct; matchdays 10-38 come one a week from Saturday 31 Oct. ESPN schedules and calendar
pages are built from the season; the other fantacalcio.it pages are the saved ones, and every votes URL
gets the saved matchday-8 page. ESPN's past seasons hold three Lazio meetings with their matchday-10
opponent, and one against a club no longer in Serie A.
"""
import gzip
import json
from collections.abc import Callable
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from functools import cache
from pathlib import Path

import requests
from conftest import FIXTURES

from fantaspec.clubs import load_clubs
from fantaspec.config import (ESPN_SEASON, H2H_SEASONS, TZ, espn_fixtures_url, espn_schedule_url,
                              espn_standings_url, fc_calendar_url, fc_lineups_url, fc_roster_url,
                              fc_unavailable_url, fc_votes_url)
from fantaspec.models import CalendarFixture, EspnMatch
from fantaspec.sources.espn import parse_standings
from fantaspec.sources.fc_roster import parse_roster
from fantaspec.sources.fc_unavailable import parse_unavailable
from fantaspec.sources.fc_votes import parse_votes

NOW = datetime(2026, 10, 30, 12, 0, tzinfo=TZ)
CLUBS = load_clubs()
MATCHDAYS = 38
LAST_PLAYED = 9
GONE_ESPN_ID = 9999  # a club no longer in Serie A

def _round_robin(keys: list[str]) -> list[list[tuple[str, str]]]:
    """Circle method: 19 rounds where every club plays once, then the same rounds with home and away swapped."""
    order, rounds = list(keys), []
    for r in range(len(order) - 1):
        n = len(order)
        rounds.append([(order[i], order[n - 1 - i]) if (r + i) % 2 == 0 else (order[n - 1 - i], order[i])
                       for i in range(n // 2)])
        order = [order[0], order[-1]] + order[1:-1]
    return rounds + [[(away, home) for home, away in rnd] for rnd in rounds]


def _kickoff(matchday: int) -> datetime:
    if matchday <= LAST_PLAYED:
        return datetime(2026, 10, 28, 20, 45, tzinfo=TZ) - timedelta(weeks=LAST_PLAYED - matchday)
    return datetime(2026, 10, 31, 18, 0, tzinfo=TZ) + timedelta(weeks=matchday - LAST_PLAYED - 1)


def _utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


class Season:
    def __init__(self, completed_yesterday: tuple[tuple[str, str, int], ...] = ()):
        rounds = _round_robin([c.key for c in CLUBS])
        rounds.insert(2, rounds.pop(next(i for i, r in enumerate(rounds) if ("lazio", "roma") in r)))
        self.calendar = {md: [CalendarFixture(md, home, away) for home, away in rnd]
                         for md, rnd in enumerate(rounds, start=1)}
        late = {(home, away): md for home, away, md in completed_yesterday}
        for (home, away), md in late.items():
            assert CalendarFixture(md, home, away) in self.calendar[md], (home, away, md)
        espn = {c.key: c.espn_id for c in CLUBS}
        self.matches = []
        for md, fixtures in self.calendar.items():
            for i, f in enumerate(fixtures):
                when, played = _kickoff(md), md <= LAST_PLAYED
                if (f.home, f.away) in late:
                    when, played = NOW.replace(hour=20, minute=45) - timedelta(days=1), True
                goals = ((md + i) % 3, (md * (i + 1)) % 2) if played else (None, None)
                self.matches.append(EspnMatch(f"{md:02d}{i:02d}", when.astimezone(timezone.utc), espn[f.home],
                                              espn[f.away], *goals, played))
        rival = next(f.away if f.home == "lazio" else f.home for f in self.calendar[LAST_PLAYED + 1]
                     if "lazio" in (f.home, f.away))
        lazio, other = espn["lazio"], espn[rival]
        self.rival = rival
        self.history = {  # ESPN season -> matches
            2019: [EspnMatch("h1", _utc(2020, 2, 9, 14, 0), lazio, other, 1, 0, True)],
            2025: [EspnMatch("h2", _utc(2025, 10, 19, 16, 0), other, lazio, 2, 2, True),
                   EspnMatch("h3", _utc(2026, 3, 1, 17, 0), lazio, other, 0, 1, True),
                   EspnMatch("h4", _utc(2026, 4, 12, 16, 0), lazio, GONE_ESPN_ID, 3, 0, True)],
        }
        self.pages = self._pages()

    def _pages(self) -> dict[str, Callable[[], str]]:
        """URL -> page text (built when asked for)."""
        pages = {
            fc_roster_url(): lambda: saved("fc_roster.html.gz"),
            fc_lineups_url(): lambda: saved("fc_lineups.html.gz"),
            fc_unavailable_url(): lambda: saved("fc_unavailable.html.gz"),
            espn_standings_url(): lambda: saved("espn_standings.json"),
        }
        for md in range(1, MATCHDAYS + 1):
            pages[fc_votes_url(md)] = lambda: saved("fc_votes_8.html.gz")
            pages[fc_calendar_url(md)] = lambda md=md: self.calendar_page(md)
        for club in CLUBS:
            mine = [m for m in self.matches if club.espn_id in (m.home_espn, m.away_espn)]
            pages[espn_schedule_url(club.espn_id, ESPN_SEASON)] = lambda mine=mine: espn_page(
                [m for m in mine if m.completed])
            pages[espn_fixtures_url(club.espn_id)] = lambda mine=mine: espn_page([m for m in mine if not m.completed])
            for season in range(ESPN_SEASON - H2H_SEASONS, ESPN_SEASON):
                past = [m for m in self.history.get(season, []) if club.espn_id in (m.home_espn, m.away_espn)]
                pages[espn_schedule_url(club.espn_id, season)] = lambda past=past: espn_page(past)
        return pages

    def calendar_page(self, md: int) -> str:
        links = "".join(f'<a href="https://www.fantacalcio.it/serie-a/calendario/{md}/2026-27/'
                        f'{f.home}-{f.away}/{18000 + 10 * md + i}">{f.home} - {f.away}</a>'
                        for i, f in enumerate(self.calendar[md]))
        return f"<html><body><nav>{links}</nav></body></html>"


@cache
def saved(name: str) -> str:
    path = FIXTURES / name
    return gzip.decompress(path.read_bytes()).decode("utf-8") if name.endswith(".gz") else path.read_text("utf-8")


def espn_page(matches: list[EspnMatch]) -> str:
    """A team schedule document as ESPN's API returns it, with only the fields the parser reads."""
    def side(where: str, espn_id: int, goals: int | None) -> dict:
        return {"homeAway": where, "id": str(espn_id), **({"score": {"value": float(goals)}} if goals is not None else {})}

    return json.dumps({"events": [
        {"id": m.espn_id, "date": m.kickoff.strftime("%Y-%m-%dT%H:%MZ"),
         "competitions": [{"competitors": [side("home", m.home_espn, m.home_goals),
                                           side("away", m.away_espn, m.away_goals)],
                           "status": {"type": {"completed": m.completed}}}]}
        for m in matches]})


_season = Season()

# raw/lineups.json as a previous run left it: Napoli's next match only. The saved page parses to something else.
SEEDED_LINEUPS = {
    "entries": [{"player_id": 2170, "name": "Milinkovic-Savic V.", "club": "napoli", "start_pct": 90,
                 "doubtful": False}],
    "pairs": [next([f.home, f.away] for f in _season.calendar[LAST_PLAYED + 1] if "napoli" in (f.home, f.away))],
}


def reset() -> None:
    global _season
    _season = Season()

# raw/lineups.json as a previous run left it: Napoli's next match only. The saved page parses to something else.
SEEDED_LINEUPS = {
    "entries": [{"player_id": 2170, "name": "Milinkovic-Savic V.", "club": "napoli", "start_pct": 90,
                 "doubtful": False}],
    "pairs": [next([f.home, f.away] for f in _season.calendar[LAST_PLAYED + 1] if "napoli" in (f.home, f.away))],
}


def current() -> Season:
    return _season


def record(item) -> dict:
    row = asdict(item)
    if isinstance(row.get("kickoff"), datetime):
        row["kickoff"] = row["kickoff"].isoformat()
    return row


def write_raw(repo: Path, name: str, data) -> None:
    path = repo / "raw" / f"{name}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def read_raw(repo: Path, name: str):
    return json.loads((repo / "raw" / f"{name}.json").read_text(encoding="utf-8"))


def read_out(repo: Path, name: str) -> dict:
    return json.loads((repo / "out" / f"{name}.json").read_text(encoding="utf-8"))


def seed_raw(repo: Path, completed_yesterday: list[tuple[str, str, int]] = ()) -> None:
    """raw/ as a previous full run left it, for a season where the given matches were played yesterday;
    the fake fetcher serves the same season. No past-season history."""
    global _season
    _season = Season(tuple(completed_yesterday))
    write_raw(repo, "calendar", {str(md): [record(f) for f in fx] for md, fx in _season.calendar.items()})
    write_raw(repo, "espn", {c.key: [record(m) for m in _season.matches if c.espn_id in (m.home_espn, m.away_espn)]
                             for c in CLUBS})
    write_raw(repo, "standings", [record(r) for r in parse_standings(json.loads(saved("espn_standings.json")))])
    write_raw(repo, "roster", [record(p) for p in parse_roster(saved("fc_roster.html.gz"))])
    write_raw(repo, "votes", {"8": [record(v) for v in parse_votes(saved("fc_votes_8.html.gz"), 8)]})
    write_raw(repo, "lineups", SEEDED_LINEUPS)
    write_raw(repo, "unavailable", [record(u) for u in parse_unavailable(saved("fc_unavailable.html.gz"))])


class FakeFetcher:
    """Serves the current season's pages and records every URL asked for."""

    def __init__(self, season: Season, fail: set[str], override: dict[str, str]):
        self.season, self.fail, self.override = season, fail, override
        self.requested: list[str] = []

    def __call__(self, url: str) -> str:
        self.requested.append(url)
        if url in self.fail:
            raise requests.ConnectionError(f"cannot reach {url}")
        if url in self.override:
            return self.override[url]
        page = self.season.pages.get(url)
        if page is None:
            raise LookupError(f"no page for {url}")
        return page()


def fake_fetcher(fail: set[str] = frozenset(), override: dict[str, str] | None = None) -> FakeFetcher:
    return FakeFetcher(_season, set(fail), override or {})

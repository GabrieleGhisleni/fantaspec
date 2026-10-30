"""One pipeline run: refresh the raw/ cache from the sources the run needs, then compute, validate and
write the site data; and the gate that picks the run for an hourly trigger.

raw/ layout (one record per line, so diffs stay small):
  calendar.json     {"<matchday>": [CalendarFixture, ...]}
  espn.json         {"<club key>": [EspnMatch, ...]}  the club's results and upcoming pages, by kickoff
  standings.json    [StandingRow, ...]
  roster.json       [RosterPlayer, ...]
  votes.json        {"<matchday>": [VoteRow, ...]}
  lineups.json      {"entries": [LineupEntry, ...], "pairs": [[home, away], ...]}
  unavailable.json  [Unavailable, ...]
  history.json      [EspnMatch, ...]  completed matches of past seasons, once each, by kickoff
"""
import json
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta

from fantaspec import config
from fantaspec.build import meta, validate, write_if_changed
from fantaspec.clubs import load_clubs
from fantaspec.config import TZ
from fantaspec.fixtures import join_fixtures
from fantaspec.models import (CalendarFixture, Club, EspnMatch, Fixture, LineupEntry, RosterPlayer, StandingRow,
                              Unavailable, VoteRow)
from fantaspec.schedule import FULL, LIGHT, due, slots
from fantaspec.sources.espn import parse_schedule, parse_standings
from fantaspec.sources.fc_calendar import parse_calendar
from fantaspec.sources.fc_lineups import parse_lineups
from fantaspec.sources.fc_roster import parse_roster
from fantaspec.sources.fc_unavailable import parse_unavailable
from fantaspec.sources.fc_votes import parse_votes
from fantaspec.stats import club_stats, player_stats

Fetcher = Callable[[str], str]

SKIP = "skip"
MATCHDAYS = 38
RECENT = timedelta(days=4)  # a full run refetches the votes of matchdays with a match completed this recently


@dataclass(frozen=True)
class RunResult:
    ok: bool  # every source refreshed and the site data validated
    errors: list[str]  # "<source>: <message>"
    wrote: bool  # site data changed and was written
    valid: bool = True  # site data could be computed and passed validation; when False nothing was written


def run(kind: str, fetch: Fetcher, now: datetime, backfill: bool = False) -> RunResult:
    """A light or full run at `now` (aware); a backfill is a full run that also fetches every calendar page,
    every played matchday's votes and the past seasons for head to head.

    A source that fails to fetch or parse (or parses to nothing where that can't be right) is reported as
    "<source>: <message>" and keeps its previous raw/ data. Site data that doesn't validate is not written.
    """
    if kind not in (LIGHT, FULL) or (backfill and kind != FULL):
        raise ValueError(f"no such run: kind={kind!r}, backfill={backfill}")
    clubs = load_clubs()
    errors: list[str] = []
    if kind == FULL:
        _refresh_calendar(fetch, errors, every=backfill)
        _refresh_espn(fetch, clubs, errors)
        _refresh("standings", errors, lambda: _standings_rows(fetch(config.espn_standings_url()), clubs))
        _refresh("roster", errors, lambda: _rows(parse_roster(fetch(config.fc_roster_url()))))
        _refresh_votes(fetch, clubs, now, errors, every=backfill)
        if backfill:
            _refresh_history(fetch, clubs, errors)
    _refresh("lineups", errors, lambda: _lineups_rows(parse_lineups(fetch(config.fc_lineups_url()))))
    _refresh("unavailable", errors,
             lambda: [_record(u) for u in parse_unavailable(fetch(config.fc_unavailable_url()))])
    return _publish(kind, clubs, now, errors)


def gate(now: datetime) -> tuple[str, str]:
    """(kind, slot) for an hourly trigger at `now` (aware): the due slot's kind and its Europe/Rome ISO time,
    or ("skip", "") outside every slot. With no fixture dates in raw/ yet: a full run, slot = this hour."""
    fixtures = _fixtures(load_clubs())
    if not any(f.kickoff for f in fixtures):
        return FULL, now.astimezone(TZ).replace(minute=0, second=0, microsecond=0).isoformat()
    slot = due(now, slots(fixtures))
    return (slot.kind, slot.at.isoformat()) if slot else (SKIP, "")


# --- refreshing raw/ --------------------------------------------------------------------------------------

def _attempt(source: str, errors: list[str], step: Callable[[], object]):
    """step() or, when it raises, None with "<source>: <error>" added to errors."""
    try:
        return step()
    except Exception as exc:  # a network error or a page the parsers no longer understand
        errors.append(f"{source}: {type(exc).__name__}: {exc}")
        return None


def _refresh(name: str, errors: list[str], step: Callable[[], object]) -> None:
    """A one-page source: save what step() returns, keep the old raw file when it fails."""
    data = _attempt(name, errors, step)
    if data is not None:
        _save(name, data)


def _refresh_calendar(fetch: Fetcher, errors: list[str], every: bool) -> None:
    stored = _load("calendar", {})
    wanted = [md for md in range(1, MATCHDAYS + 1) if every or str(md) not in stored]
    fetched = {}
    for md in wanted:
        rows = _attempt(f"calendar: matchday {md}", errors,
                        lambda: _rows(parse_calendar(fetch(config.fc_calendar_url(md)), md)))
        if rows is not None:
            fetched[str(md)] = rows
    if fetched:
        _save("calendar", _by_matchday({**stored, **fetched}))


def _refresh_espn(fetch: Fetcher, clubs: list[Club], errors: list[str]) -> None:
    """Each club's results and upcoming fixtures; a club whose pages fail keeps its previous matches."""
    def pages(club: Club) -> list[dict]:
        results = parse_schedule(json.loads(fetch(config.espn_schedule_url(club.espn_id, config.ESPN_SEASON))))
        upcoming = parse_schedule(json.loads(fetch(config.espn_fixtures_url(club.espn_id))))
        return _rows(sorted(results + upcoming, key=lambda m: (m.kickoff, m.espn_id)))

    stored = _load("espn", {})
    fetched = {}
    for club in clubs:
        rows = _attempt(f"espn: {club.key}", errors, lambda: pages(club))
        if rows is not None:
            fetched[club.key] = rows
    if fetched:
        merged = stored | fetched
        _save("espn", {c.key: merged[c.key] for c in clubs if c.key in merged})


def _refresh_votes(fetch: Fetcher, clubs: list[Club], now: datetime, errors: list[str], every: bool) -> None:
    """The votes of every matchday with a match completed in the last RECENT (every played matchday when
    `every`), including a postponed match finally played: its votes are on its own matchday's page."""
    played = [f for f in _fixtures(clubs) if f.completed]
    wanted = sorted({f.matchday for f in played if every or now - f.kickoff <= RECENT})
    fetched = {}
    for md in wanted:
        rows = _attempt(f"votes: matchday {md}", errors, lambda: _rows(parse_votes(fetch(config.fc_votes_url(md)), md)))
        if rows is not None:
            fetched[str(md)] = rows
    if fetched:
        _save("votes", _by_matchday({**_load("votes", {}), **fetched}))


def _refresh_history(fetch: Fetcher, clubs: list[Club], errors: list[str]) -> None:
    """Completed matches of the past H2H_SEASONS seasons, added to what raw/ already holds."""
    stored = {m["espn_id"]: m for m in _load("history", [])}
    fetched = False
    for season in range(config.ESPN_SEASON - config.H2H_SEASONS, config.ESPN_SEASON):
        for club in clubs:
            matches = _attempt(f"history: {season} {club.key}", errors, lambda: parse_schedule(
                json.loads(fetch(config.espn_schedule_url(club.espn_id, season)))))
            if matches is not None:
                fetched = True
                stored |= {m.espn_id: _record(m) for m in matches if m.completed}
    if fetched:
        _save("history", sorted(stored.values(), key=lambda m: (m["kickoff"], m["espn_id"])))


def _rows(items: list) -> list[dict]:
    """Records of a page that must list something."""
    if not items:
        raise ValueError("no rows")
    return [_record(item) for item in items]


def _standings_rows(text: str, clubs: list[Club]) -> list[dict]:
    rows = parse_standings(json.loads(text))
    missing = sorted(c.key for c in clubs if c.espn_id not in {r.espn_id for r in rows})
    if missing:
        raise ValueError(f"missing {', '.join(missing)}")
    return _rows(rows)


def _lineups_rows(page: tuple[list[LineupEntry], set[tuple[str, str]]]) -> dict:
    entries, pairs = page
    return {"entries": [_record(e) for e in entries], "pairs": sorted([list(p) for p in pairs])}


def _by_matchday(pages: dict[str, list]) -> dict[str, list]:
    return dict(sorted(pages.items(), key=lambda item: int(item[0])))


# --- computing and publishing -----------------------------------------------------------------------------

def _publish(kind: str, clubs: list[Club], now: datetime, errors: list[str]) -> RunResult:
    try:
        fixtures = _fixtures(clubs)
        clubs_out = club_stats(fixtures, [StandingRow(**r) for r in _load("standings", [])], _history(clubs),
                               clubs, now)
        votes = [VoteRow(**r) for rows in _load("votes", {}).values() for r in rows]
        players_out = player_stats([RosterPlayer(**r) for r in _load("roster", [])], votes, fixtures, _lineups(),
                                   [Unavailable(**r) for r in _load("unavailable", [])], clubs_out)
        problems = [f"validation: {p}" for p in validate(clubs_out, players_out)]
    except Exception as exc:  # raw/ missing or incomplete
        problems = [f"build: {type(exc).__name__}: {exc}"]
    if problems:
        return RunResult(ok=False, errors=errors + problems, wrote=False, valid=False)
    files = {"meta": meta(kind, errors, fixtures, now), "clubs": clubs_out, "players": players_out}
    return RunResult(ok=not errors, errors=errors, wrote=write_if_changed(config.OUT_DIR, files))


def _fixtures(clubs: list[Club]) -> list[Fixture]:
    calendar = [CalendarFixture(**r) for rows in _load("calendar", {}).values() for r in rows]
    espn = [_match(r) for rows in _load("espn", {}).values() for r in rows]
    return join_fixtures(calendar, espn, clubs)


def _history(clubs: list[Club]) -> list[Fixture]:
    """Past seasons' matches between two current clubs, as matchday-0 fixtures."""
    key_of = {c.espn_id: c.key for c in clubs}
    return [Fixture(0, key_of[m.home_espn], key_of[m.away_espn], m.kickoff, m.home_goals, m.away_goals, True)
            for m in map(_match, _load("history", []))
            if m.completed and m.home_espn in key_of and m.away_espn in key_of]


def _lineups() -> tuple[list[LineupEntry], set[tuple[str, str]]]:
    stored = _load("lineups", {"entries": [], "pairs": []})
    return [LineupEntry(**r) for r in stored["entries"]], {(home, away) for home, away in stored["pairs"]}


# --- raw/ files -------------------------------------------------------------------------------------------

def _record(item) -> dict:
    row = asdict(item)
    if isinstance(row.get("kickoff"), datetime):
        row["kickoff"] = row["kickoff"].isoformat()
    return row


def _match(row: dict) -> EspnMatch:
    return EspnMatch(**{**row, "kickoff": datetime.fromisoformat(row["kickoff"])})


def _load(name: str, default):
    path = config.RAW_DIR / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _save(name: str, data: list | dict) -> None:
    """Write raw/<name>.json unless it already holds exactly this."""
    path = config.RAW_DIR / f"{name}.json"
    text = _dumps(data)
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _dumps(data: list | dict) -> str:
    """JSON with one record per line: a list of records, or an object whose values are lists of records."""
    if isinstance(data, dict):
        return "{\n" + ",\n".join(f"  {json.dumps(k)}: {_lines(v, '  ')}" for k, v in data.items()) + "\n}\n"
    return _lines(data, "") + "\n"


def _lines(rows: list, indent: str) -> str:
    if not rows:
        return "[]"
    body = ",\n".join(f"{indent}  {json.dumps(r, ensure_ascii=False, sort_keys=True)}" for r in rows)
    return f"[\n{body}\n{indent}]"

import statistics
from collections import defaultdict
from datetime import datetime

from fantaspec.config import TZ
from fantaspec.models import Club, Fixture, LineupEntry, RosterPlayer, StandingRow, Unavailable, VoteRow
from fantaspec.names import match_player

LAST = 5  # matches in form, head to head and a player's last 5
STATUS_PRIORITY = ("suspended", "injured", "doubtful", "warned")
CLEAN_SHEET_ROLES = ("P", "D")


def club_stats(fixtures: list[Fixture], standings: list[StandingRow], history: list[Fixture], clubs: list[Club],
               now: datetime) -> dict[str, dict]:
    """The clubs.json object, keyed by club slug.

    Position and points come from the standings; played, form, goals and the home/away split from
    the completed fixtures, so goals per game always divide by the matches the goals come from.
    """
    table = {row.espn_id: row for row in standings}
    out = {}
    for club in clubs:
        row = table[club.espn_id]
        played = _completed(fixtures, club.key)
        totals = _split(played, club.key)
        out[club.key] = {
            "key": club.key,
            "name": club.name,
            "position": row.position,
            "points": row.points,
            "played": totals["played"],
            "form": [_result(f, club.key) for f in played[-LAST:]],
            "gf": totals["gf"],
            "ga": totals["ga"],
            "home": _split([f for f in played if f.home == club.key], club.key),
            "away": _split([f for f in played if f.away == club.key], club.key),
            "next": _next_match(fixtures, history, club.key, now),
        }
    return out


def player_stats(roster: list[RosterPlayer], votes: list[VoteRow], fixtures: list[Fixture],
                 lineups: tuple[list[LineupEntry], set[str]], unavailable: list[Unavailable],
                 clubs_out: dict[str, dict]) -> dict[str, dict]:
    """The players.json object, keyed by player id: every roster player plus every player with a vote.

    A player no longer on the roster has club None and the name and role of their latest vote row.
    """
    entries, covered = lineups
    rows: dict[int, list[VoteRow]] = defaultdict(list)
    for row in votes:
        rows[row.player_id].append(row)
    on_roster = {p.id for p in roster}
    people = [(p.id, p.name, p.club, p.role) for p in roster]
    for pid in sorted(rows.keys() - on_roster):
        latest = max(rows[pid], key=lambda r: r.matchday)
        people.append((pid, latest.name, None, latest.role))

    recent = {key: _completed(fixtures, key)[-LAST:] for key in clubs_out}
    match_of = {(f.matchday, side): f for f in fixtures if f.completed for side in (f.home, f.away)}
    start_pct = {e.player_id: e.start_pct for e in entries}
    status = _statuses(roster, entries, unavailable)
    out = {}
    for pid, name, club, role in people:
        mine = rows.get(pid, [])
        # The lineups page has this club's next match (a club with no fixture left has none).
        on_page = club in covered and clubs_out.get(club, {}).get("next") is not None
        out[str(pid)] = {
            "id": pid,
            "name": name,
            "club": club,
            "role": role,
            "season": _season(mine, role, match_of),
            "last5": _last5(mine, recent.get(club, [])),
            "status": status.get(pid),
            "startPct": start_pct.get(pid, 0) if on_page else None,
        }
    return out


def _score(f: Fixture, club: str) -> tuple[int, int]:
    """(scored, conceded) by `club` in a completed fixture."""
    return (f.home_goals, f.away_goals) if f.home == club else (f.away_goals, f.home_goals)


def _result(f: Fixture, club: str) -> str:
    scored, conceded = _score(f, club)
    return "W" if scored > conceded else "D" if scored == conceded else "L"


def _completed(fixtures: list[Fixture], club: str) -> list[Fixture]:
    """The club's completed fixtures by kickoff, oldest first (a postponed match counts when it was played)."""
    return sorted((f for f in fixtures if f.completed and club in (f.home, f.away)), key=lambda f: f.kickoff)


def _split(played: list[Fixture], club: str) -> dict:
    return {"played": len(played), "gf": sum(_score(f, club)[0] for f in played),
            "ga": sum(_score(f, club)[1] for f in played)}


def _next_match(fixtures: list[Fixture], history: list[Fixture], club: str, now: datetime) -> dict | None:
    """The club's earliest match not completed that kicks off after `now`, with the head to head.

    Skipped: a match ESPN doesn't list (no kickoff) and one whose kickoff has passed without a
    result (postponed with no new date yet, or being played right now).
    """
    ahead = [f for f in fixtures
             if club in (f.home, f.away) and not f.completed and f.kickoff is not None and f.kickoff > now]
    f = min(ahead, key=lambda f: f.kickoff, default=None)
    if f is None:
        return None
    opponent = f.away if f.home == club else f.home
    meetings = [m for m in _completed(history + fixtures, club) if opponent in (m.home, m.away)]
    return {
        "opponent": opponent,
        "home": f.home == club,
        "kickoff": f.kickoff.astimezone(TZ).isoformat(),
        "matchday": f.matchday,
        "h2h": [_result(m, club) for m in meetings[-LAST:]],
    }


def _season(rows: list[VoteRow], role: str, match_of: dict[tuple[int, str], Fixture]) -> dict:
    voted = [r for r in rows if r.vote is not None]
    return {
        "pres": len(voted),
        "medV": _median([r.vote for r in voted]),
        "medFV": _median([r.fanta_vote for r in voted]),
        **_totals(rows),
        "cs": sum(_clean_sheet(r, match_of) for r in voted) if role in CLEAN_SHEET_ROLES else None,
    }


def _last5(rows: list[VoteRow], recent: list[Fixture]) -> dict:
    """The player in their club's last (up to) 5 completed matches, matched on matchday whatever
    club the vote row is for, so a player who changed club keeps their earlier votes."""
    by_matchday = {r.matchday: r for r in rows}
    found = [by_matchday.get(f.matchday) for f in recent]
    present = [r for r in found if r is not None]
    return {
        "played": sum(r.vote is not None for r in present),
        **_totals(present),
        "fv": [r.fanta_vote if r is not None else None for r in found],
    }


def _totals(rows: list[VoteRow]) -> dict:
    return {"g": sum(r.goals + r.pens_scored for r in rows), "gs": sum(r.conceded for r in rows),
            "a": sum(r.assists for r in rows)}


def _clean_sheet(row: VoteRow, match_of: dict[tuple[int, str], Fixture]) -> bool:
    """The club the row is for conceded 0 in its completed fixture of that matchday."""
    f = match_of.get((row.matchday, row.club))
    return f is not None and _score(f, row.club)[1] == 0


def _median(values: list[float]) -> float | None:
    return round(statistics.median(values), 2) if values else None


def _statuses(roster: list[RosterPlayer], entries: list[LineupEntry],
              unavailable: list[Unavailable]) -> dict[int, dict]:
    """Each flagged player's most serious status; unavailable names not on the roster are skipped."""
    notes: dict[int, dict[str, str]] = defaultdict(dict)  # player id -> kind -> text
    for u in unavailable:
        pid = match_player(u.name, u.club, roster)
        if pid is not None:
            notes[pid].setdefault(u.kind, u.text)
    for e in entries:
        if e.doubtful:
            notes[e.player_id].setdefault("doubtful", "")
    out = {}
    for pid, kinds in notes.items():
        kind = next(k for k in STATUS_PRIORITY if k in kinds)
        out[pid] = {"kind": kind, "text": kinds[kind]}
    return out

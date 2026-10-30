from datetime import UTC, datetime

from fantaspec.models import EspnMatch, StandingRow


def parse_teams(doc: dict) -> dict[int, str]:
    """ESPN teams document -> {espn id: display name}."""
    teams = doc["sports"][0]["leagues"][0]["teams"]
    return {int(t["team"]["id"]): t["team"]["displayName"] for t in teams}


def parse_schedule(doc: dict) -> list[EspnMatch]:
    """ESPN team schedule (results or upcoming fixtures) -> one EspnMatch per event."""
    return [_parse_event(event) for event in doc["events"]]


def _parse_event(event: dict) -> EspnMatch:
    competition = event["competitions"][0]
    sides = {c["homeAway"]: c for c in competition["competitors"]}
    completed = bool(competition["status"]["type"]["completed"])
    return EspnMatch(
        espn_id=str(event["id"]),
        kickoff=datetime.fromisoformat(event["date"]).astimezone(UTC),
        home_espn=int(sides["home"]["id"]),
        away_espn=int(sides["away"]["id"]),
        home_goals=_goals(sides["home"]) if completed else None,
        away_goals=_goals(sides["away"]) if completed else None,
        completed=completed,
    )


def _goals(competitor: dict) -> int:
    return int(competitor["score"]["value"])


def parse_standings(doc: dict) -> list[StandingRow]:
    """ESPN standings document -> one StandingRow per club."""
    rows = []
    for group in doc["children"]:
        for entry in group["standings"]["entries"]:
            stats = {s["name"]: s.get("value") for s in entry["stats"]}
            rows.append(
                StandingRow(
                    espn_id=int(entry["team"]["id"]),
                    position=int(stats["rank"]),
                    points=int(stats["points"]),
                    played=int(stats["gamesPlayed"]),
                )
            )
    return rows

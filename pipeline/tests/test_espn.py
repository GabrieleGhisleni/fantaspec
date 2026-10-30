from datetime import UTC, date, datetime

from conftest import load_fixture

from fantaspec.sources.espn import parse_schedule, parse_standings


def test_parse_schedule_napoli():
    ms = parse_schedule(load_fixture("espn_schedule_napoli_2026.json"))
    monza = next(m for m in ms if m.kickoff == datetime(2026, 10, 28, 19, 45, tzinfo=UTC))
    assert (monza.home_espn, monza.away_espn, monza.home_goals, monza.completed) == (4007, 114, 1, True)
    frosinone = next(m for m in ms if m.kickoff.date() == date(2026, 10, 10))
    assert (frosinone.home_espn, frosinone.home_goals, frosinone.away_goals) == (114, 3, 0)


def test_parse_standings():
    rows = parse_standings(load_fixture("espn_standings.json"))
    assert len(rows) == 20
    assert sorted(r.position for r in rows) == list(range(1, 21))

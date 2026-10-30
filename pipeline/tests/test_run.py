from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest
from league import (CLUBS, NOW, SEEDED_LINEUPS, current, espn_page, fake_fetcher, read_out, read_raw, reset,
                    seed_raw, write_raw)

from fantaspec import __main__ as cli
from fantaspec.config import (ESPN_SEASON, H2H_SEASONS, TZ, espn_fixtures_url, espn_schedule_url, fc_calendar_url,
                              fc_lineups_url, fc_roster_url, fc_unavailable_url, fc_votes_url)
from fantaspec.run import RunResult, gate, run


@pytest.fixture(autouse=True)
def fresh_season():
    reset()


def seed_out(repo) -> None:
    """web/public/data as a good full run on the seeded raw/ writes it."""
    result = run("full", fake_fetcher(), now=NOW)
    assert result.ok and result.wrote, result.errors


def raw_files(repo) -> dict[str, tuple[bytes, int]]:
    return {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in (repo / "raw").iterdir()}


def test_postponed_match_votes_are_fetched(tmp_repo):
    seed_raw(tmp_repo, completed_yesterday=[("lazio", "roma", 3)])   # matchday 3 match played yesterday
    fetch = fake_fetcher()
    run("full", fetch, now=NOW)
    assert fc_votes_url(3) in fetch.requested
    assert fc_votes_url(9) in fetch.requested                      # played on Wednesday
    assert fc_votes_url(2) not in fetch.requested and fc_votes_url(4) not in fetch.requested
    assert read_raw(tmp_repo, "votes").keys() == {"3", "8", "9"}


def test_failed_source_keeps_old_raw_and_reports(tmp_repo):
    seed_raw(tmp_repo)                                # previous good raw files
    fetch = fake_fetcher(fail={fc_lineups_url()})     # every other URL served from tests/fixtures
    result = run("light", fetch, now=NOW)
    assert result.errors and result.errors[0].startswith("lineups:")
    assert read_raw(tmp_repo, "lineups") == SEEDED_LINEUPS
    assert read_out(tmp_repo, "meta")["lastRun"]["ok"] is False
    assert fetch.requested == [fc_lineups_url(), fc_unavailable_url()]
    assert result.ok is False and result.wrote is True    # first site data, written with the failure noted
    assert read_out(tmp_repo, "players")["2170"]["startPct"] == 90      # from the kept raw/lineups.json


def test_layout_change_never_overwrites_site_data(tmp_repo):
    seed_raw(tmp_repo); seed_out(tmp_repo)
    seeded_roster, seeded_players = read_raw(tmp_repo, "roster"), read_out(tmp_repo, "players")
    fetch = fake_fetcher(override={fc_roster_url(): "<html></html>"})
    result = run("full", fetch, now=NOW + timedelta(minutes=5))
    assert result.ok is False and result.wrote is False
    assert read_out(tmp_repo, "players") == seeded_players
    assert read_raw(tmp_repo, "roster") == seeded_roster
    assert result.errors == ["roster: ValueError: no rows"]
    assert read_out(tmp_repo, "meta")["lastRun"]["errors"] == result.errors


def test_same_slot_twice_writes_once(tmp_repo):
    seed_raw(tmp_repo)
    first = run("full", fake_fetcher(), now=NOW)
    assert first.wrote is True and first.ok, first.errors
    raw_after_first = raw_files(tmp_repo)
    assert run("full", fake_fetcher(), now=NOW + timedelta(hours=1)).wrote is False
    assert raw_files(tmp_repo) == raw_after_first
    assert read_out(tmp_repo, "meta")["lastRun"]["at"] == "2026-10-30T12:00:00+01:00"


def test_full_run_fetches_only_missing_calendar_pages_and_no_history(tmp_repo):
    seed_raw(tmp_repo)
    calendar = read_raw(tmp_repo, "calendar")
    del calendar["38"]
    write_raw(tmp_repo, "calendar", calendar)
    fetch = fake_fetcher()
    assert run("full", fetch, now=NOW).ok
    assert [u for u in fetch.requested if "/calendario/" in u] == [fc_calendar_url(38)]
    assert len(read_raw(tmp_repo, "calendar")["38"]) == 10
    assert not any(f"season={ESPN_SEASON - 1}" in u for u in fetch.requested)


def test_validation_failure_writes_nothing(tmp_repo):
    seed_raw(tmp_repo); seed_out(tmp_repo)
    meta_before = read_out(tmp_repo, "meta")
    write_raw(tmp_repo, "roster", [])                 # a broken cache: too few players
    result = run("light", fake_fetcher(), now=NOW + timedelta(days=1))
    assert (result.ok, result.wrote, result.valid) == (False, False, False)
    assert any(e.startswith("validation: players") for e in result.errors)
    assert read_out(tmp_repo, "meta") == meta_before


def test_backfill_fills_raw_from_scratch(tmp_repo):
    fetch = fake_fetcher()
    result = run("full", fetch, now=NOW, backfill=True)
    assert result.ok and result.wrote, result.errors
    for md in range(1, 39):
        assert fc_calendar_url(md) in fetch.requested
    assert [u for u in fetch.requested if "voti" in u] == [fc_votes_url(md) for md in range(1, 10)]
    for club in CLUBS:
        for season in range(ESPN_SEASON - H2H_SEASONS, ESPN_SEASON):
            assert espn_schedule_url(club.espn_id, season) in fetch.requested
    assert len(read_raw(tmp_repo, "calendar")) == 38
    assert [m["espn_id"] for m in read_raw(tmp_repo, "history")] == ["h1", "h2", "h3", "h4"]   # once each
    lazio = read_out(tmp_repo, "clubs")["lazio"]
    assert lazio["next"]["opponent"] == current().rival and lazio["next"]["matchday"] == 10
    assert lazio["next"]["h2h"] == ["W", "D", "L"]
    assert read_out(tmp_repo, "meta")["nextMatchday"] == {"number": 10, "from": "2026-10-31", "to": "2026-10-31"}
    assert read_out(tmp_repo, "players")["572"]["season"]["pres"] > 0


def test_espn_pages_must_cover_the_whole_season(tmp_repo):
    seed_raw(tmp_repo); seed_out(tmp_repo)
    espn, clubs, meta = read_raw(tmp_repo, "espn"), read_out(tmp_repo, "clubs"), read_out(tmp_repo, "meta")
    napoli = [m for m in current().matches if 114 in (m.home_espn, m.away_espn)]
    pages = {espn_fixtures_url(c.espn_id): espn_page([]) for c in CLUBS}     # upcoming pages come back empty
    # Napoli's upcoming page lists a played match instead of its first upcoming one: 38 events, 37 different
    pages[espn_fixtures_url(114)] = espn_page(napoli[:1] + [m for m in napoli if not m.completed][1:])
    result = run("full", fake_fetcher(override=pages), now=NOW + timedelta(minutes=5))
    assert result.errors == [f"espn: {c.key}: ValueError: only {37 if c.key == 'napoli' else 9} of 38 matches"
                             for c in CLUBS]
    assert result.wrote is False
    assert read_raw(tmp_repo, "espn") == espn
    assert read_out(tmp_repo, "clubs") == clubs
    assert read_out(tmp_repo, "meta")["nextMatchday"] == meta["nextMatchday"] == {
        "number": 10, "from": "2026-10-31", "to": "2026-10-31"}


def test_a_club_with_its_season_over_needs_no_upcoming_page(tmp_repo):
    seed_raw(tmp_repo)
    # as if Napoli had played its whole season: its 29 unplayed matches moved a year back and completed
    napoli = [m if m.completed else replace(m, kickoff=m.kickoff - timedelta(days=365), completed=True,
                                            home_goals=1, away_goals=0)
              for m in current().matches if 114 in (m.home_espn, m.away_espn)]
    pages = {espn_schedule_url(114, ESPN_SEASON): espn_page(napoli), espn_fixtures_url(114): espn_page([])}
    result = run("full", fake_fetcher(override=pages), now=NOW)
    assert result.errors == []
    assert len(read_raw(tmp_repo, "espn")["napoli"]) == 38
    assert read_out(tmp_repo, "clubs")["napoli"]["next"] is None


def test_votes_not_out_yet_are_skipped_silently(tmp_repo):
    seed_raw(tmp_repo, completed_yesterday=[("lazio", "roma", 3)])   # ended yesterday at 22:45, 13 h ago
    fetch = fake_fetcher(override={fc_votes_url(3): "<html><body></body></html>"})
    result = run("full", fetch, now=NOW)
    assert fc_votes_url(3) in fetch.requested
    assert result.ok and result.errors == []
    assert read_raw(tmp_repo, "votes").keys() == {"8", "9"}    # matchday 3 keeps what raw/ had (nothing)


def test_votes_still_missing_a_day_after_the_matchday_are_an_error(tmp_repo):
    seed_raw(tmp_repo)                                             # matchday 9 ended Wednesday at 22:45
    votes = read_raw(tmp_repo, "votes")
    result = run("full", fake_fetcher(override={fc_votes_url(9): "<html><body></body></html>"}), now=NOW)
    assert result.errors == ["votes: matchday 9: ValueError: no rows"]
    assert read_raw(tmp_repo, "votes") == votes


def test_first_full_run_on_empty_raw_is_a_backfill(tmp_repo):
    fetch = fake_fetcher()
    result = run("full", fetch, now=NOW)
    assert result.ok and result.wrote, result.errors
    for club in CLUBS:
        assert espn_schedule_url(club.espn_id, ESPN_SEASON - 1) in fetch.requested
    assert [u for u in fetch.requested if "voti" in u] == [fc_votes_url(md) for md in range(1, 10)]
    assert [m["espn_id"] for m in read_raw(tmp_repo, "history")] == ["h1", "h2", "h3", "h4"]
    assert read_out(tmp_repo, "meta")["lastRun"]["kind"] == "full"


def test_gate_without_raw_runs_full_once_a_day(tmp_repo):
    assert gate(datetime(2026, 10, 30, 12, 20, tzinfo=TZ)) == ("full", "2026-10-30T00:00:00+01:00")
    assert gate(datetime(2026, 10, 30, 23, 59, tzinfo=TZ)) == ("full", "2026-10-30T00:00:00+01:00")   # same slot


def test_gate_follows_the_slots(tmp_repo):
    seed_raw(tmp_repo)
    assert gate(NOW + timedelta(minutes=7)) == ("full", "2026-10-30T12:00:00+01:00")   # 2nd day after matchday 9
    assert gate(datetime(2026, 10, 30, 19, 7, tzinfo=TZ)) == ("light", "2026-10-30T19:00:00+01:00")
    assert gate(datetime(2026, 10, 30, 15, 7, tzinfo=TZ)) == ("skip", "")
    assert gate(datetime(2026, 11, 1, 0, 59, tzinfo=TZ)) == ("full", "2026-10-31T23:30:00+01:00")   # late trigger


def test_gate_runs_full_when_no_fixture_left_has_a_date(tmp_repo):
    seed_raw(tmp_repo)
    espn = read_raw(tmp_repo, "espn")
    write_raw(tmp_repo, "espn", {k: [m for m in v if m["completed"]] for k, v in espn.items()})   # dates lost
    # once a day: the slot is the local date, so the workflow runs it once
    assert gate(datetime(2026, 10, 30, 15, 7, tzinfo=TZ)) == ("full", "2026-10-30T00:00:00+01:00")
    assert gate(datetime(2026, 10, 30, 16, 7, tzinfo=TZ)) == ("full", "2026-10-30T00:00:00+01:00")
    assert gate(datetime(2026, 10, 30, 23, 30, tzinfo=timezone.utc)) == ("full", "2026-10-31T00:00:00+01:00")
    # season over: every fixture completed, no fallback
    write_raw(tmp_repo, "espn", {k: [{**m, "completed": True, "home_goals": 1, "away_goals": 1} for m in v]
                                 for k, v in espn.items()})
    assert gate(datetime(2027, 6, 1, 15, 7, tzinfo=TZ)) == ("skip", "")


def test_cli_gate_prints_and_appends_to_github_output(tmp_repo, monkeypatch, capsys):
    output = tmp_repo / "github_output"
    output.write_text("before=1\n")
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    assert cli.main(["gate"]) == 0
    printed = capsys.readouterr().out
    assert printed.startswith("kind=full\nslot=20") and printed.count("\n") == 2   # no raw/ yet
    assert output.read_text() == "before=1\n" + printed


def test_cli_run_exits_1_only_when_validation_failed(monkeypatch):
    calls = []

    def fake_run(result):
        def run_(kind, fetch, now, backfill=False):
            calls.append((kind, backfill, now.tzinfo is not None))
            return result
        return run_

    monkeypatch.setattr(cli, "run", fake_run(RunResult(False, ["lineups: down"], False)))
    assert cli.main(["run", "--kind", "light"]) == 0
    monkeypatch.setattr(cli, "run", fake_run(RunResult(False, ["validation: clubs: 19"], False, valid=False)))
    assert cli.main(["run", "--kind", "full", "--backfill"]) == 1
    assert calls == [("light", False, True), ("full", True, True)]
    with pytest.raises(SystemExit):
        cli.main(["run", "--kind", "light", "--backfill"])

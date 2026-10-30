import json
from datetime import date, datetime, time, timedelta, timezone

from fantaspec.build import meta, next_matchday, validate, write_if_changed
from fantaspec.config import TZ
from fantaspec.models import Fixture

NOW = datetime(2026, 10, 30, 12, 0, tzinfo=TZ)
STAMP = "2026-10-31T10:07:12+01:00"


def sample_outputs(updated_at: str = STAMP, run_at: str = STAMP, kind: str = "light", ok: bool = True,
                   errors: tuple[str, ...] = (), fv: float = 6.5) -> dict[str, dict]:
    """A tiny meta/clubs/players set; `fv` changes the site data."""
    return {
        "meta": {"season": "2026-27", "updatedAt": updated_at,
                 "lastRun": {"at": run_at, "kind": kind, "ok": ok, "errors": list(errors)},
                 "nextMatchday": {"number": 10, "from": "2026-10-31", "to": "2026-11-02"}},
        "clubs": {"napoli": {"key": "napoli", "name": "Napoli", "position": 4}},
        "players": {"572": {"id": 572, "name": "Meret", "club": "napoli", "role": "P", "medFV": fv},
                    "2105": {"id": 2105, "name": "Soulè", "club": "roma", "role": "A", "medFV": None}},
    }


def on_disk(out, name: str) -> dict:
    return json.loads((out / f"{name}.json").read_text(encoding="utf-8"))


def test_write_if_changed_ignores_timestamps(tmp_path):
    files = sample_outputs()
    assert write_if_changed(tmp_path, files) is True
    again = sample_outputs(updated_at="2026-11-01T10:00:00+01:00", run_at="2026-11-01T10:00:00+01:00")
    assert write_if_changed(tmp_path, again) is False
    assert on_disk(tmp_path, "meta") == files["meta"]


def test_write_if_changed_writes_sorted_indented_utf8(tmp_path):
    files = sample_outputs()
    write_if_changed(tmp_path, files)
    for name, data in files.items():
        text = (tmp_path / f"{name}.json").read_text(encoding="utf-8")
        assert text == json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    assert "Soulè" in (tmp_path / "players.json").read_text(encoding="utf-8")


def test_write_if_changed_bumps_updated_at_with_the_data(tmp_path):
    write_if_changed(tmp_path, sample_outputs())
    later = "2026-11-01T23:30:05+01:00"
    assert write_if_changed(tmp_path, sample_outputs(updated_at=later, run_at=later, kind="full", fv=7.0)) is True
    assert on_disk(tmp_path, "meta")["updatedAt"] == later
    assert on_disk(tmp_path, "meta")["lastRun"]["kind"] == "full"
    assert on_disk(tmp_path, "players")["572"]["medFV"] == 7.0


def test_write_if_changed_records_a_new_run_outcome_without_bumping_updated_at(tmp_path):
    write_if_changed(tmp_path, sample_outputs())
    clubs_written = (tmp_path / "clubs.json").stat().st_mtime_ns
    later = "2026-11-01T10:00:00+01:00"
    failed = sample_outputs(updated_at=later, run_at=later, ok=False, errors=("lineups: boom",))
    assert write_if_changed(tmp_path, failed) is False
    assert on_disk(tmp_path, "meta") == {**failed["meta"], "updatedAt": STAMP}
    assert (tmp_path / "clubs.json").stat().st_mtime_ns == clubs_written


def test_write_if_changed_ignores_the_run_kind_alone(tmp_path):
    files = sample_outputs()
    write_if_changed(tmp_path, files)
    assert write_if_changed(tmp_path, sample_outputs(kind="full", run_at="2026-11-01T10:00:00+01:00")) is False
    assert on_disk(tmp_path, "meta") == files["meta"]


def test_validate_rejects_empty_scrape():
    assert validate({}, {}) != []


def good_site() -> tuple[dict, dict]:
    clubs = {f"club{i}": {"key": f"club{i}"} for i in range(20)}
    players = {str(n): {"id": n, "club": f"club{n % 20}", "role": "PDCA"[n % 4], "startPct": n % 101}
               for n in range(400)}
    return clubs, players


def test_validate_accepts_a_sane_site_and_names_each_problem():
    clubs, players = good_site()
    assert validate(clubs, players) == []
    players["7"]["club"] = None                       # left Serie A: fine
    players["8"]["startPct"] = None                   # club not on the lineups page: fine
    assert validate(clubs, players) == []
    del clubs["club19"]
    players["1"]["club"] = "pisa"
    players["2"]["role"] = "Por"
    players["3"]["startPct"] = 101
    del players["399"]
    problems = validate(clubs, players)
    assert len(problems) == 5
    assert any("19" in p for p in problems)           # clubs
    assert any("399" in p for p in problems)          # players
    assert sum("pisa" in p or "club19" in p for p in problems) == 1
    assert any("Por" in p for p in problems) and any("101" in p for p in problems)


def kickoff(day: date, hour: int = 18) -> datetime:
    return datetime.combine(day, time(hour), tzinfo=TZ).astimezone(timezone.utc)


def matchday(number: int, unplayed: int, first: date = date(2026, 11, 4), last: date | None = None) -> list[Fixture]:
    """Ten fixtures of `number`: the played ones a week before `first`, then `unplayed` ones with
    kickoffs spread from `first` to `last` (local dates)."""
    last = last or first
    played = [Fixture(number, f"h{number}-{i}", f"a{number}-{i}", kickoff(first - timedelta(weeks=1)), 1, 0, True)
              for i in range(10 - unplayed)]
    ahead = [Fixture(number, f"h{number}-{i}", f"a{number}-{i}",
                     kickoff(first + (last - first) * i // max(unplayed - 1, 1)), None, None, False)
             for i in range(unplayed)]
    return played + ahead


def test_next_matchday_ignores_lone_postponed_match():
    fx = matchday(3, unplayed=1) + matchday(10, unplayed=10, first=date(2026, 10, 31), last=date(2026, 11, 2))
    assert next_matchday(fx, NOW) == {"number": 10, "from": "2026-10-31", "to": "2026-11-02"}


def test_next_matchday_uses_local_dates_and_what_is_still_to_play():
    fx = matchday(10, unplayed=10, first=date(2026, 10, 31), last=date(2026, 11, 2))
    late = [Fixture(10, "x", "y", datetime(2026, 11, 2, 23, 30, tzinfo=timezone.utc), None, None, False)]  # 3 Nov in Rome
    assert next_matchday(fx + late, NOW)["to"] == "2026-11-03"
    saturday_night = datetime(2026, 10, 31, 23, 0, tzinfo=TZ)   # 5 of round 10 kicked off already
    assert next_matchday(fx, saturday_night) == {"number": 10, "from": "2026-11-01", "to": "2026-11-02"}
    assert next_matchday(matchday(38, unplayed=0), NOW) is None


def test_meta_shape():
    fx = matchday(10, unplayed=10, first=date(2026, 10, 31), last=date(2026, 11, 2))
    now = datetime(2026, 10, 30, 11, 7, 12, 345, tzinfo=timezone.utc)
    assert meta("full", ["lineups: boom"], fx, now) == {
        "season": "2026-27",
        "updatedAt": "2026-10-30T12:07:12+01:00",
        "lastRun": {"at": "2026-10-30T12:07:12+01:00", "kind": "full", "ok": False, "errors": ["lineups: boom"]},
        "nextMatchday": {"number": 10, "from": "2026-10-31", "to": "2026-11-02"},
    }
    assert meta("light", [], fx, now)["lastRun"]["ok"] is True

### Task 7: Build, validate, write-if-changed, and the run orchestration

**Files:**
- Create: `pipeline/fantaspec/build.py`, `pipeline/fantaspec/run.py`, `pipeline/fantaspec/__main__.py`
- Test: `pipeline/tests/test_build.py`, `pipeline/tests/test_run.py`

**Interfaces:**
- Consumes: every parser, `join_fixtures`, `club_stats`, `player_stats`, `slots`, `due`.
- Produces:
  - `build.validate(clubs: dict, players: dict) -> list[str]` — errors when: clubs ≠ 20; fewer than 400 players; a player's `club` is not null and not a club key; any `role` outside P/D/C/A; any `startPct` outside 0–100.
  - `build.next_matchday(fixtures: list[Fixture], now: datetime) -> dict | None` — the lowest matchday with at least 5 unplayed fixtures (so a lone postponed match doesn't count); `from`/`to` are the local dates of its first and last unplayed kickoff. Goes into `meta.nextMatchday`.
  - `build.write_if_changed(out_dir: Path, files: dict[str, dict]) -> bool` — compares each file with what's on disk ignoring `meta.updatedAt` and `meta.lastRun.at`; writes all files (2-space indented JSON, keys sorted) and sets `updatedAt` only when something differs; returns whether it wrote.
  - `run.Fetcher = Callable[[str], str]`; `run.run(kind: str, fetch: Fetcher, now: datetime, backfill: bool = False) -> RunResult(ok: bool, errors: list[str], wrote: bool)`.
  - CLI: `python -m fantaspec gate` prints `kind=<light|full|skip>` and appends it to `$GITHUB_OUTPUT` when set; `python -m fantaspec run --kind <light|full> [--backfill]` exits 0 unless validation failed (exit 1).

Run behaviour:
- `light`: fetch lineups and unavailable; reuse everything else from `raw/`.
- `full`: also ESPN schedules for the 20 clubs (current season), standings, roster, calendar pages for matchdays missing from `raw/calendar.json`, and the votes pages of every matchday that has a fixture completed in the last 4 days.
- `--backfill`: all 38 calendar pages, every completed matchday's votes, and ESPN schedules for the previous `H2H_SEASONS` seasons into `raw/history.json` (fetched only on backfill).
- Each source is parsed right after fetching; a fetch or parse error adds `"<source>: <message>"` to `errors` and leaves that `raw/` file untouched. Parsed results are written to `raw/<source>.json` only when changed.
- Then compute, validate, and `write_if_changed` meta, clubs and players into `OUT_DIR`. `lastRun.ok` is `false` when `errors` is not empty.
- Gate: load fixtures from `raw/`, `due(now, slots(...))`; empty `raw/` → `full`.

- [ ] **Step 1: Write the failing tests**

```python
def test_write_if_changed_ignores_timestamps(tmp_path):
    files = sample_outputs()
    assert write_if_changed(tmp_path, files) is True
    again = sample_outputs(updated_at="2026-11-01T10:00:00+01:00", run_at="2026-11-01T10:00:00+01:00")
    assert write_if_changed(tmp_path, again) is False

def test_validate_rejects_empty_scrape():
    assert validate({}, {}) != []

def test_next_matchday_ignores_lone_postponed_match():
    fx = matchday(3, unplayed=1) + matchday(10, unplayed=10, first=date(2026, 10, 31), last=date(2026, 11, 2))
    assert next_matchday(fx, NOW) == {"number": 10, "from": "2026-10-31", "to": "2026-11-02"}

def test_postponed_match_votes_are_fetched(tmp_repo):
    seed_raw(tmp_repo, completed_yesterday=[("lazio", "roma", 3)])   # matchday 3 match played yesterday
    fetch = fake_fetcher()
    run("full", fetch, now=NOW)
    assert fc_votes_url(3) in fetch.requested

def test_failed_source_keeps_old_raw_and_reports(tmp_repo):
    seed_raw(tmp_repo)                                # previous good raw files
    fetch = fake_fetcher(fail={fc_lineups_url()})     # every other URL served from tests/fixtures
    result = run("light", fetch, now=NOW)
    assert result.errors and result.errors[0].startswith("lineups:")
    assert read_raw(tmp_repo, "lineups") == SEEDED_LINEUPS
    assert read_out(tmp_repo, "meta")["lastRun"]["ok"] is False

def test_layout_change_never_overwrites_site_data(tmp_repo):
    seed_raw(tmp_repo); seed_out(tmp_repo)
    fetch = fake_fetcher(override={fc_roster_url(): "<html></html>"})
    result = run("full", fetch, now=NOW)
    assert result.ok is False and result.wrote is False
    assert read_out(tmp_repo, "players") == SEEDED_PLAYERS

def test_same_slot_twice_writes_once(tmp_repo):
    seed_raw(tmp_repo)
    assert run("full", fake_fetcher(), now=NOW).wrote is True
    assert run("full", fake_fetcher(), now=NOW + timedelta(hours=1)).wrote is False
```
`tmp_repo` is a fixture that points `RAW_DIR` and `OUT_DIR` at `tmp_path` (monkeypatch `config`).

- [ ] **Step 2: Run** `python -m pytest tests/test_build.py tests/test_run.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** `build.py`, `run.py`, `__main__.py` (argparse). `run` takes the fetcher as a parameter; the CLI passes `http.fetch_text`.
- [ ] **Step 4: Run the whole suite** `python -m pytest -v`. Expected: all PASS.
- [ ] **Step 5: Real backfill.** From the repo root: `cd pipeline && pip install -e . && python -m fantaspec run --kind full --backfill`. Expected: exit 0, `raw/` filled, `web/public/data/{meta,clubs,players}.json` written; `jq '.["572"].season' ../web/public/data/players.json` shows Meret with `pres` > 0.
- [ ] **Step 6: Commit** `git add pipeline raw web/public/data && git commit -m "pipeline: build, validation, run orchestration, first backfill"`.

---


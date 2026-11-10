### Task 2: Python package, club mapping and ESPN parsing

**Files:**
- Create: `pipeline/pyproject.toml`, `pipeline/fantaspec/{__init__,config,clubs,http,models}.py`, `pipeline/fantaspec/clubs.json`, `pipeline/fantaspec/sources/__init__.py`, `pipeline/fantaspec/sources/espn.py`
- Test: `pipeline/tests/test_espn.py`, `pipeline/tests/test_clubs.py`, fixtures `pipeline/tests/fixtures/espn_teams.json`, `espn_schedule_napoli_2026.json`, `espn_standings.json`

**Interfaces:**
- Produces:
  - `config.py`: `SEASON = "2026-27"`, `ESPN_SEASON = 2026`, `TZ = ZoneInfo("Europe/Rome")`, `H2H_SEASONS = 10`, `REPO_ROOT`, `RAW_DIR = REPO_ROOT / "raw"`, `OUT_DIR = REPO_ROOT / "web/public/data"`, and URL helpers `espn_teams_url()`, `espn_schedule_url(espn_id: int, season: int) -> str` (`.../ita.1/teams/{id}/schedule?season={season}`), `espn_fixtures_url(espn_id: int) -> str` (`...?fixture=true`), `espn_standings_url()`, `fc_votes_url(matchday: int)`, `fc_roster_url()`, `fc_calendar_url(matchday: int)` (`https://www.fantacalcio.it/serie-a/calendario/{matchday}`), `fc_lineups_url()`, `fc_unavailable_url()`.
  - `models.py` (frozen dataclasses): `Club(key: str, name: str, espn_id: int)`; `EspnMatch(espn_id: str, kickoff: datetime, home_espn: int, away_espn: int, home_goals: int | None, away_goals: int | None, completed: bool)`; `StandingRow(espn_id: int, position: int, points: int, played: int)`.
  - `clubs.load_clubs() -> list[Club]`, `clubs.by_espn() -> dict[int, Club]`, `clubs.by_key() -> dict[str, Club]`.
  - `http.fetch_text(url: str) -> str`, `http.fetch_json(url: str) -> dict`.
  - `espn.parse_teams(doc: dict) -> dict[int, str]` (espn id → display name), `espn.parse_schedule(doc: dict) -> list[EspnMatch]`, `espn.parse_standings(doc: dict) -> list[StandingRow]`.

- [x] **Step 1: Save the ESPN fixtures.** Already saved on 2026-10-30: `espn_teams.json`, `espn_schedule_napoli_2026.json`, `espn_standings.json` in `pipeline/tests/fixtures/`.
- [ ] **Step 2: Write `clubs.json`**: 20 rows `{"key", "name", "espn_id"}` for keys `atalanta bologna cagliari como fiorentina frosinone genoa inter juventus lazio lecce milan monza napoli parma roma sassuolo torino udinese venezia`, Italian display names, espn ids from the saved teams file (known: milan 103, roma 104, atalanta 105, bologna 107, napoli 114, como 2572, cagliari 2925, monza 4007).
- [ ] **Step 3: Write the failing tests**

```python
def test_clubs_mapping_complete():
    clubs = load_clubs()
    assert len(clubs) == 20
    assert len({c.espn_id for c in clubs}) == 20
    assert set(by_espn()) == set(parse_teams(load_fixture("espn_teams.json")))

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
```
`load_fixture(name)` lives in `tests/conftest.py` and reads `.json`, `.html` or `.html.gz` from `tests/fixtures/`.

- [ ] **Step 4: Run** `cd pipeline && python -m pytest tests/test_espn.py tests/test_clubs.py -v`. Expected: FAIL (imports missing).
- [ ] **Step 5: Implement** `pyproject.toml` (package `fantaspec`, dependencies `requests`, `beautifulsoup4`, optional group `test = ["pytest"]`, package data `clubs.json`), `config.py` (`REPO_ROOT = Path(__file__).resolve().parents[2]`), `models.py`, `clubs.py`, `http.py` and `sources/espn.py`. Goals come from `competitors[].score.value`; `home_goals`/`away_goals` are `None` unless `status.type.completed`. Kickoff is the event `date` parsed as UTC.
- [ ] **Step 6: Run the tests again.** Expected: PASS.
- [ ] **Step 7: Commit** `git commit -m "pipeline: package skeleton, club mapping, ESPN parsers"`.

---


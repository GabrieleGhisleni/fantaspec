# Task 2 report: Python package, club mapping and ESPN parsing

Status: DONE
Commit: `8e01ef7 pipeline: package skeleton, club mapping, ESPN parsers`

## What I implemented

- `pipeline/pyproject.toml`: setuptools package `fantaspec` (packages `fantaspec`, `fantaspec.sources`),
  `requires-python >=3.12`, deps `requests`, `beautifulsoup4`, optional `test = ["pytest"]`,
  package data `clubs.json`, `[tool.pytest.ini_options] testpaths = ["tests"]`.
- `fantaspec/config.py`: `SEASON`, `ESPN_SEASON`, `TZ`, `H2H_SEASONS`, `REPO_ROOT`
  (`Path(__file__).resolve().parents[2]`), `RAW_DIR`, `OUT_DIR`, and all nine URL helpers exactly as
  the brief lists (`espn_fixtures_url` = `.../teams/{id}/schedule?fixture=true`; votes URL uses `SEASON`).
- `fantaspec/models.py`: frozen dataclasses `Club`, `EspnMatch`, `StandingRow` with the brief's fields.
- `fantaspec/clubs.json`: 20 rows `{key, name, espn_id}`; keys are the fantacalcio.it slugs (cross-checked
  against the slugs in `fc_roster.html.gz`), Italian names (Inter, Milan, Roma, ...), ESPN ids from
  `espn_teams.json` (fiorentina 109, frosinone 4057, genoa 3263, inter 110, juventus 111, lazio 112,
  lecce 113, parma 115, sassuolo 3997, torino 239, udinese 118, venezia 17530 + the known ones).
- `fantaspec/clubs.py`: `load_clubs()` (reads the package data via `importlib.resources`), `by_espn()`, `by_key()`.
- `fantaspec/http.py`: `fetch_text`, `fetch_json`; one `requests.get` per attempt with a Chrome-like
  User-Agent, 30 s timeout, `raise_for_status`, 3 attempts, sleeps 2 s then 4 s between attempts, the
  last attempt's exception propagates.
- `fantaspec/sources/espn.py`: `parse_teams` (`sports[0].leagues[0].teams[].team` → `{int id: displayName}`),
  `parse_schedule` (one `EspnMatch` per event; home/away by `homeAway`; `completed` from
  `competitions[0].status.type.completed`; goals from `competitors[].score.value` only when completed;
  kickoff = event `date` via `fromisoformat(...).astimezone(UTC)`), `parse_standings` (entries of every
  `children[].standings`, stats `rank`, `points`, `gamesPlayed`).
- `tests/conftest.py`: plain function `load_fixture(name)` (`.json` → dict, `.html` → str,
  `.html.gz` → decompressed str). Tests import it with `from conftest import load_fixture` (works with
  pytest's default `prepend` import mode because `tests/` has no `__init__.py`). No pytest fixture
  wrapper was added (YAGNI).
- `tests/test_clubs.py`, `tests/test_espn.py`: the three tests from the brief, verbatim.
- Plan: ticked Task 2 steps 2-7 in `docs/superpowers/plans/2026-10-30-fantaspec.md`.

## TDD evidence

RED (after writing clubs.json, conftest and tests; venv had only pytest/requests/bs4, package not implemented):

```
$ cd pipeline && .venv/bin/python -m pytest tests/test_espn.py tests/test_clubs.py -v
collecting ... collected 0 items / 2 errors
tests/test_espn.py:5: in <module>
    from fantaspec.sources.espn import parse_schedule, parse_standings
E   ModuleNotFoundError: No module named 'fantaspec.sources'
tests/test_clubs.py:3: in <module>
    from fantaspec.clubs import by_espn, load_clubs
E   ModuleNotFoundError: No module named 'fantaspec.clubs'
!!!!!!!!!!!!!!!!!!! Interrupted: 2 errors during collection !!!!!!!!!!!!!!!!!!!!
============================== 2 errors in 0.08s ===============================
```
Expected: the brief's Step 4 says FAIL (imports missing); only `clubs.json` existed in `fantaspec/`.

GREEN:

```
$ cd pipeline && .venv/bin/python -m pytest tests/test_espn.py tests/test_clubs.py -v
platform linux -- Python 3.12.13, pytest-9.2.0, pluggy-1.7.0
tests/test_espn.py::test_parse_schedule_napoli PASSED                    [ 33%]
tests/test_espn.py::test_parse_standings PASSED                          [ 66%]
tests/test_clubs.py::test_clubs_mapping_complete PASSED                  [100%]
============================== 3 passed in 0.01s ===============================
```

Full suite before commit, warnings as errors, on both CI's and the local Python:

```
$ cd pipeline && .venv/bin/python -m pytest -v -W error        # Python 3.12.13
3 passed in 0.01s
$ cd pipeline && <scratch venv 3.14.6>/bin/python -m pytest -q -W error
3 passed in 0.01s
```

## Extra verification (not committed, scratch script)

- `http`: with `requests.get` and `time.sleep` monkeypatched: fail, fail, succeed → 3 calls, sleeps
  `[2, 4]`, UA `Mozilla/5.0 ...`, timeout 30; three failures → `HTTPError` raised after 3 calls;
  `requests.Timeout` is retried the same way.
- `parse_schedule` on a live `.../teams/114/schedule?fixture=true` response (saved only in the scratchpad,
  not in the repo): 29 upcoming matches, `score` absent, all `completed=False`, goals `None`. The status
  lives under `competitions[0].status` there too, so one code path covers results and fixtures.
- `REPO_ROOT` resolves to `/home/ggabry/projects/fantaspec`; all URL helpers print the expected URLs.

## Files changed

- `/home/ggabry/projects/fantaspec/pipeline/pyproject.toml`
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/__init__.py`
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/config.py`
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/models.py`
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/clubs.json`
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/clubs.py`
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/http.py`
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/sources/__init__.py`
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/sources/espn.py`
- `/home/ggabry/projects/fantaspec/pipeline/tests/conftest.py`
- `/home/ggabry/projects/fantaspec/pipeline/tests/test_clubs.py`
- `/home/ggabry/projects/fantaspec/pipeline/tests/test_espn.py`
- `/home/ggabry/projects/fantaspec/docs/superpowers/plans/2026-10-30-fantaspec.md` (Task 2 checkboxes)

Fixtures in `pipeline/tests/fixtures/` untouched. `pipeline/.venv` (Python 3.12.13, editable install
with `[test]`) and `fantaspec.egg-info` are git-ignored.

## Self-review

- Completeness: every interface in the brief exists with the given names/signatures; tests verbatim.
- Simplified `http._get` during review: the loop retries `ATTEMPTS - 1` times and the final attempt runs
  outside it, so no "unreachable" guard is needed.
- YAGNI: no caching in `clubs`, no pytest fixture wrapper, no extra parsing fields.

## Concerns

- `http.py` has no committed unit test (the brief lists none and no `test_http.py`); its retry behaviour
  was verified with a mocked scratch script only. A small test could be added later if wanted.
- `fetch_text` relies on the server's charset (fantacalcio.it sends `text/html; charset=utf-8`, checked
  2026-10-30), so `response.text` decodes correctly.
- The venv is built with Python 3.12 (`~/.asdf/installs/python/3.12.13`) for CI parity; the CLAUDE.md
  command `cd pipeline && python -m pytest` with the global 3.14 needs pytest available there
  (or use `pipeline/.venv/bin/python -m pytest`).

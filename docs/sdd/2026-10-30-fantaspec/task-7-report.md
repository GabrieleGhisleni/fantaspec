# Task 7 report: build, validate, write-if-changed, run orchestration, first backfill

Status: DONE_WITH_CONCERNS (minor ones, listed at the end)

Commits:
- `a72d281` pipeline: build, validation, run orchestration (code, tests, plan ticks for steps 1–4)
- `8c866df` pipeline: first backfill (raw/, web/public/data/, plan ticks for steps 5–6)

## What I implemented

### `pipeline/fantaspec/build.py`
- `validate(clubs, players) -> list[str]` returns one message per broken rule: clubs ≠ 20, fewer than 400
  players, unknown club, role outside P/D/C/A, startPct outside 0–100. A message names up to 5 offenders
  as `id (value)` plus "and N more". A `null` club or startPct is fine.
- `next_matchday(fixtures, now)` returns the lowest matchday with ≥ 5 fixtures still to play. "Still to
  play" means not completed, with a kickoff after `now`, which is the same test `stats._next_match` uses.
  `from`/`to` are the Europe/Rome dates of the first and last of those fixtures; the result is `None`
  when no matchday qualifies.
- `meta(kind, errors, fixtures, now)` builds the meta.json dict: `updatedAt` = `lastRun.at` = `now` in
  Europe/Rome, ISO to the second, and `ok = not errors`.
- `write_if_changed(out_dir, files)` follows the R2 contract:
  - **Site data changed** means clubs or players differ from disk, or a meta field other than
    `updatedAt`/`lastRun` does. All files are then written with the new `updatedAt`, and it returns True.
  - **Only `lastRun.ok`/`errors` differ:** only meta.json is rewritten, keeping the stored `updatedAt`.
    Returns False.
  - **Only timestamps or `lastRun.kind` differ:** nothing is written. Returns False.
  - Files are JSON with a 2-space indent, sorted keys, UTF-8 (`ensure_ascii=False`) and a trailing newline.

### `pipeline/fantaspec/run.py`
- `Fetcher = Callable[[str], str]`. ESPN pages arrive as text and are parsed with `json.loads`.
- `RunResult(ok, errors, wrote, valid=True)`. **Deviation:** I added a 4th field, `valid`, with a default.
  It is False when the site data could not be computed or failed validation. The CLI needs it to exit 1
  only on that case, and it is cleaner than looking for a "validation:" prefix in the errors.
- `run(kind, fetch, now, backfill=False)`:
  - **light** fetches lineups and unavailable.
  - **full** also fetches calendar pages for matchdays missing from raw/, both ESPN pages for each of
    the 20 clubs (`espn_schedule_url(id, ESPN_SEASON)` and `espn_fixtures_url(id)`, per R13), standings
    and roster. It then fetches the votes of every matchday with a fixture completed within 4 days of
    `now`. That set comes from the fixtures just refreshed, so a postponed match played late brings in
    its original matchday's page.
  - **backfill** fetches all 38 calendar pages, the votes of every matchday with a completed fixture,
    and 20 clubs × 10 past seasons into `raw/history.json`. `backfill` together with `light` raises
    ValueError, and the CLI refuses it.
  - **Fetch or parse errors:** each one adds `"<source>: <ExceptionType>: <message>"` to the errors and
    leaves that raw/ data untouched. Sources that span several pages are kept per page. Examples:
    `calendar: matchday 12: …`, `votes: matchday 9: …`, `espn: napoli: …`, `history: 2019 napoli: …`.
  - **Sources that must not be empty:** a parse with no rows raises `ValueError("no rows")`, which
    becomes that source's error (R2). This applies to roster, calendar pages, each club's ESPN pair and
    votes pages. Standings are an error if any of the 20 clubs is missing. Lineups and unavailable may be
    empty.
  - **Writing raw/:** a raw file is written only when its text changes.
  - **Publishing:** after the fetches, the run computes stats and validates. If computing raises (for
    example, raw/ missing) it adds a `build: …` error; if validation fails it adds `validation: …`
    errors. In both cases nothing is written to OUT_DIR and the result is `valid=False, ok=False,
    wrote=False`. Otherwise it calls `write_if_changed`.
  - `config.RAW_DIR`/`OUT_DIR` are read at call time.
- `gate(now) -> (kind, slot)`: loads the fixtures from raw/ and calls `due(now, slots(...))`. The
  result is the slot's kind plus `slot.at.isoformat()` in Europe/Rome, or `("skip", "")`.
  - **Empty raw/** (no fixture has a kickoff): the result is `("full", <current hour in Europe/Rome,
    truncated>)`. I chose this so that `slot` is empty exactly when `kind=skip` (R12, documented in the
    docstring).

### `pipeline/fantaspec/__main__.py`
- `python -m fantaspec gate` prints `kind=…` and `slot=…` and appends both lines to `$GITHUB_OUTPUT` when
  it is set.
- `python -m fantaspec run --kind light|full [--backfill]`:
  - prints the errors to stderr and one `ok=… wrote=… errors=N` line;
  - exits 1 only when `valid` is False;
  - uses `http.fetch_text` wrapped in `polite()`, which sleeps 1 s before each fantacalcio.it request.

### `pipeline/fantaspec/fixtures.py` (deferred review note)
- `join_fixtures`: when ESPN lists a match more than once, the last copy still wins, but a completed copy
  is never replaced by a copy that isn't completed. My raw layout can mix a stale page of one club (kept
  after a failed fetch) with a fresh page of the other club.

### http.py decoding (deferred note)
- I checked with one request per host. fantacalcio.it sends `text/html; charset=utf-8` and ESPN sends
  `application/json;charset=UTF-8`. "Soulè" is an HTML entity in the page.
- The backfill output has Kessiè, Traorè Hj., Montipò, Konè M., Soulè and Dodò correct, with no mojibake.
  No fix was needed.

## raw/ file layout

Every file has one record per line, so diffs stay small. Records are the dataclasses as dicts, with
`kickoff` as ISO UTC.

| file | shape |
|---|---|
| `calendar.json` | `{"<md>": [CalendarFixture…]}` in matchday order |
| `espn.json` | `{"<club key>": [EspnMatch…]}`: the club's results and upcoming pages merged, sorted by kickoff |
| `standings.json` | `[StandingRow…]` |
| `roster.json` | `[RosterPlayer…]` |
| `votes.json` | `{"<md>": [VoteRow…]}` in matchday order |
| `lineups.json` | `{"entries": [LineupEntry…], "pairs": [[home, away]…]}`: pairs sorted, turned back into a set of tuples on load |
| `unavailable.json` | `[Unavailable…]` |
| `history.json` | `[EspnMatch…]`: completed past-season matches, deduplicated by ESPN event id and merged with what was already stored, sorted by kickoff |

On load, `history.json` is filtered to matches where both clubs are current. They become matchday-0
`Fixture`s for `club_stats`, so this season's matches are never counted twice.

## Tests

- `tests/test_build.py` (11 tests): the brief's three tests verbatim, plus:
  - JSON formatting and UTF-8;
  - a data change bumps `updatedAt`;
  - a status-only rewrite keeps `updatedAt` and leaves clubs untouched (R2);
  - a change of `kind` alone writes nothing;
  - a sane site passes `validate` and each rule is reported;
  - `next_matchday` uses local dates (00:30 in Rome counts as the next day) and only fixtures not yet
    kicked off, and returns `None` when nothing is left;
  - the shape of `meta`.
- `tests/test_run.py` (12 tests): the brief's five run tests, plus:
  - only missing calendar pages are fetched and no history is fetched outside a backfill;
  - a validation failure writes nothing;
  - a backfill from an empty raw/ fetches all 38 calendar pages, votes 1–9 and 200 history pages,
    deduplicates the history, gives h2h `W D L` and `nextMatchday`;
  - the gate with an empty raw/ and on real slots: 12:00 full, 19:00 light, skip at 15:07, and a late
    trigger at 00:59 still gets the 23:30 slot;
  - the CLI gate output and `$GITHUB_OUTPUT`;
  - the CLI exit codes and `--backfill` with light rejected.
- Changes to the brief's tests:
  - **`test_layout_change_never_overwrites_site_data`:** `seed_out` runs a good full run (R2), and
    `SEEDED_PLAYERS` became a local `seeded_players` read after seeding. I added assertions that the
    roster raw is unchanged and that meta records exactly `roster: ValueError: no rows`. Without them,
    a bug that saved an empty roster would still pass, because validation would block the write.
  - **`test_failed_source_keeps_old_raw_and_reports`:** I added that the light run requests only the
    lineups and unavailable URLs, and that the kept seeded lineups feed `startPct` (90).
  - **`test_same_slot_twice_writes_once`:** I added that the first run is clean, that the second run
    leaves raw/ unchanged (bytes and mtimes), and that `lastRun.at` stays at the first run.
- `tests/test_fixtures.py`: new test, the completed copy wins whichever order the copies come in.
- `tests/league.py` (new helper, like the existing `season.py`):
  - a made-up season of the 20 real clubs (double round robin, Lazio–Roma moved to matchday 3), with
    matchdays 1–9 played up to Wed 28 Oct and matchdays 10–38 weekly from Sat 31 Oct;
  - ESPN schedule documents and calendar pages generated from that season;
  - saved pages for roster, lineups, unavailable, standings and votes (every votes URL gets the saved
    matchday-8 page);
  - past seasons with three Lazio meetings against its matchday-10 opponent and one match against a club
    no longer in Serie A;
  - `seed_raw`, which writes raw/ as a previous run would have left it and sets the season the fake
    fetcher serves (module state, reset by an autouse fixture in test_run.py);
  - `fake_fetcher(fail=, override=)` with `.requested`.
- `tests/conftest.py`: the `tmp_repo` fixture, which monkeypatches `config.RAW_DIR`/`OUT_DIR` to
  tmp_path/raw and tmp_path/out.

### TDD evidence
RED (before any implementation):
```
$ cd pipeline && .venv/bin/python -m pytest tests/test_build.py tests/test_run.py tests/test_fixtures.py -q
E   ModuleNotFoundError: No module named 'fantaspec.build'
E   ImportError: cannot import name '__main__' from 'fantaspec'
ERROR tests/test_build.py
ERROR tests/test_run.py
$ .venv/bin/python -m pytest tests/test_fixtures.py -q
FAILED tests/test_fixtures.py::test_join_prefers_the_completed_copy_of_a_match
1 failed, 2 passed in 0.04s
```
GREEN:
```
$ .venv/bin/python -m pytest tests/test_build.py tests/test_run.py tests/test_fixtures.py -q
24 passed in 15.90s
$ .venv/bin/python -m pytest -q
53 passed in 17.52s
```
`ruff check --select F,E9` on fantaspec and tests: all checks passed.

## Real backfill (2026-10-30, 11:49 Europe/Rome)

`cd pipeline && .venv/bin/python -m fantaspec run --kind full --backfill`
→ `ok=true wrote=true errors=0`, exit 0, 4 min 52 s wall clock (1 s pause before each fantacalcio.it
request). There were no source errors and nothing needed a rerun.

The run made about 290 requests: 38 calendar pages, 9 votes pages, roster, lineups, unavailable,
standings, 40 current ESPN pages and 200 history pages.

| raw/ | size | content |
|---|---|---|
| calendar.json | 23k | 38 matchdays × 10, 380 unique pairs |
| espn.json | 126k | 38 matches per club (9 played + 29 upcoming) |
| votes.json | 667k | md 1–9: 319/319/319/317/316/320/316/316/317 rows |
| roster.json | 40k | 603 players |
| lineups.json | 45k | the 10 matchday-10 matches |
| unavailable.json | 21k | |
| standings.json | 1.3k | 20 rows |
| history.json | 562k | 3632 matches from 2016-17 to 2025-26 |

ESPN's past-season pages turned out to be league-only: Venezia appears only in its Serie A seasons
(2021, 2024). Site data comes to 312k: players.json 297k, clubs.json 12k.

Sanity excerpt:
```
meta: nextMatchday {"number": 10, "from": "2026-10-31", "to": "2026-11-02"}, lastRun ok, errors []
players: 616 (13 no longer on the roster), roles D 216 / C 212 / A 112 / P 76, startPct set for 603
"572" Meret napoli P: season {pres 6, medV 6.0, medFV 4.5, g 0, gs 9, a 0, cs 2},
      last5.fv [null, 6.0, 5.0, 3.5, null], startPct 90 (Milinkovic-Savic 5 on today's page)
1  inter      25pt 9g 25-10 DWWWW next=milan     md10 2026-10-31T20:45+01:00 h2h=WLDLL
2  lazio      25pt 9g 22-7  WWWWW next=cagliari  md10 2026-11-01T15:00+01:00 h2h=WWWWD
3  roma       21pt 9g 23-8  DDWDW next=udinese   md10 2026-10-31T18:00+01:00 h2h=WWWWL
7  napoli     14pt 9g 17-11 DWLDW next=juventus  md10 2026-11-01T20:45+01:00 h2h=WDWWL
20 venezia     3pt 9g 6-19  LLWLL next=como      md10 2026-11-01T12:30+01:00 h2h=DD
```
All 20 clubs have played 9 and have a matchday-10 next match.

Gate run once at 11:54:36:
```
$ .venv/bin/python -m fantaspec gate
kind=skip
slot=
```
That is correct. The week's real slots are Thu 29 10:00 L / 23:30 F (a matchday-9 match on Thursday),
Fri 30 09:00 L / 12:00 F / 19:00 L, Sat–Mon 10:00 L / 23:30 F, and Tue 03 12:00 F. At 11:54 the latest
slot that has started is 09:00, more than 90 minutes ago; the next slot is today at 12:00 (full).

## Files changed
- New: `pipeline/fantaspec/build.py`, `pipeline/fantaspec/run.py`, `pipeline/fantaspec/__main__.py`,
  `pipeline/tests/test_build.py`, `pipeline/tests/test_run.py`, `pipeline/tests/league.py`
- Modified: `pipeline/fantaspec/fixtures.py`, `pipeline/tests/conftest.py`, `pipeline/tests/test_fixtures.py`,
  `docs/superpowers/plans/2026-10-30-fantaspec.md` (Task 7 steps 1–6 ticked)
- Data: `raw/*.json` (8 files), `web/public/data/{meta,clubs,players}.json`

## Self-review
- Run behaviour bullets: light, full, backfill, per-source errors that keep raw/, raw written only on
  change, compute → validate → write_if_changed, `lastRun.ok`, and the gate are all covered by tests.
- R2:
  - empty-parse errors: covered;
  - a validation failure writes nothing and returns `wrote` False: tested;
  - `wrote` means site data changed: covered;
  - status-only rewrite keeps `updatedAt`: tested;
  - timestamps or kind alone write nothing: tested.
- R12 (`kind` + `slot`, `$GITHUB_OUTPUT`) and R13 (both ESPN pages per club) are done.
- I fixed during development the ESPN merge precedence: stored data was winning over freshly fetched data
  before the tests ran. I also changed history so it is saved only when at least one page was fetched,
  instead of creating an empty file when every page failed.
- The suite takes about 18 s, most of it in the run tests: each full run parses the saved roster, votes
  and lineups HTML.

## Concerns
1. **Empty votes page counts as an error.** R2 doesn't list votes among the sources that must never be
   empty, and I chose to treat them as such: we only fetch votes for matchdays with a completed match,
   and the backfill must not silently produce `pres` 0 everywhere. The risk is a false
   `lastRun.ok=false` if fantacalcio.it hasn't published any vote by the 23:30 run after a round's very
   first match. It clears at the next run.
2. **`RunResult` has an extra `valid` field** (defaulting to True), used for the CLI exit code.
3. **`next_matchday` changes during a round.** "Still to play" uses `kickoff > now`, so during a round
   `from` moves to the first remaining kickoff, as the brief's wording says. On the round's last day,
   when fewer than 5 matches remain, `nextMatchday` already points to the next round (the brief's
   threshold).
4. **The fake fetcher relies on module state** (`league._season`, set by `seed_raw`, reset by an autouse
   fixture), because the brief's tests call `fake_fetcher()` with no arguments after
   `seed_raw(..., completed_yesterday=...)`.

---

# Fix round 1

Commit: `a3d7b98` pipeline: guard ESPN fixtures, tolerate unpublished votes, auto-backfill on empty raw.
Files changed: `pipeline/fantaspec/run.py`, `pipeline/tests/test_run.py`. The real network backfill was
not rerun.

## Changes

### 1. ESPN pages must hold the whole season (review finding)
- `_refresh_espn` now counts the distinct ESPN event ids on each club's results and upcoming pages
  together.
- Fewer than `MATCHDAYS` (38) is that club's error, for example
  `espn: napoli: ValueError: only 9 of 38 matches`. The club's stored matches are then kept.
- At season end a club's upcoming page is empty but its results page holds all 38 events, so it still
  passes. In the real backfill every club had exactly 38 events.

### Gate fallback
- `gate()` now returns `full` with slot = the current hour (Europe/Rome, truncated) in two cases:
  - there are no fixtures at all (empty raw/), as before;
  - the calendar has fixtures not completed, but none of them has a kickoff after `now`.
- That second case means the dates were lost, and it lets a later full run repair raw/. When every
  fixture is completed (season over), the gate behaves as before.

### 2. R14: votes not out yet
- For each wanted matchday, `_refresh_votes` takes the latest kickoff among its completed fixtures and
  adds `MATCH_LENGTH` (2 h) to estimate when the match finished.
- An empty votes page is an error (`votes: matchday N: ValueError: no rows`) only when that finish was
  more than `VOTES_DUE` (24 h) ago.
- Otherwise the empty page is skipped silently and the matchday's previous raw votes are kept.

### 3. R15: first run is a backfill
- `run("full", …)` with no calendar in raw/ (missing or empty) behaves as `backfill=True`.
- `lastRun.kind` is still `full`.
- With the gate's empty-raw/ fallback, the season's first scheduled run is therefore a backfill.

## New tests (`tests/test_run.py`)
- `test_espn_pages_must_cover_the_whole_season`:
  - the setup is the reviewer's probe: a good full run, then a full run in which every upcoming page is
    `{"events": []}`;
  - Napoli's upcoming page also lists a played match instead of its first upcoming one, which gives 38
    rows but 37 distinct events;
  - expected: exactly 20 `espn:` errors ("only 9 of 38", and "only 37 of 38" for Napoli), `wrote`
    False, raw `espn.json` unchanged, clubs.json unchanged, `nextMatchday` still matchday 10.
- `test_a_club_with_its_season_over_needs_no_upcoming_page`: Napoli's results page lists all 38 matches
  as played and its upcoming page is empty. Expected: no errors, 38 stored matches, `next` null.
- `test_votes_not_out_yet_are_skipped_silently`: Lazio–Roma (matchday 3) ended yesterday at 22:45 and
  its page is empty. Expected: no error, `ok`, and matchday 3 not added to raw votes.
- `test_votes_still_missing_a_day_after_the_matchday_are_an_error`: matchday 9 ended Wednesday at 22:45
  and its page is empty on Friday. Expected: `["votes: matchday 9: ValueError: no rows"]` and raw votes
  unchanged.
- `test_first_full_run_on_empty_raw_is_a_backfill`: `run("full")` without the flag on an empty raw/.
  Expected: the history URLs of every club are requested, votes 1–9 are fetched, history is stored and
  `lastRun.kind` is `full`.
- `test_gate_runs_full_when_no_fixture_left_has_a_date`:
  - raw ESPN reduced to played matches → `("full", "2026-10-30T15:00:00+01:00")` at 15:07, an hour that
    is normally skipped;
  - every fixture completed → `("skip", "")`.

## TDD evidence
RED, with the new tests and the old code:
```
$ cd pipeline && .venv/bin/python -m pytest tests/test_run.py -q
FAILED tests/test_run.py::test_espn_pages_must_cover_the_whole_season - assert [] == ['espn: atalanta: ValueError: only 9 of 38 matches', ...]
FAILED tests/test_run.py::test_votes_not_out_yet_are_skipped_silently - RunResult(ok=False, errors=['votes: matchday 3: ValueError: no rows'], ...)
FAILED tests/test_run.py::test_first_full_run_on_empty_raw_is_a_backfill - history URL .../teams/105/schedule?season=2025 not requested
FAILED tests/test_run.py::test_gate_runs_full_when_no_fixture_left_has_a_date - ('skip', '') == ('full', ...)
4 failed, 13 passed
```
The two new tests that passed before the fix guard against regressions: a finished club stays valid, and
an overdue empty votes page stays an error.

GREEN:
```
$ .venv/bin/python -m pytest tests/test_run.py tests/test_build.py -q
27 passed in 27.93s
$ .venv/bin/python -m pytest -q
59 passed in 28.86s
$ uvx ruff check fantaspec tests --select F,E9
All checks passed!
```
While writing the season-over test, my first version marked Napoli's future matches as completed while
keeping their future dates. They then counted as "recent" and pulled 29 votes pages (11 s). The test now
moves those matches a year back, which is a realistic finished season, and runs in about 1.5 s.

## Concern from this round
- **The gate fallback can run hourly full runs.** It runs a full run every hour while all remaining
  fixtures have past kickoffs and are not completed. Two cases trigger it: the season's final matches
  while they are being played (2–3 hours), and a postponed match at season end whose new date ESPN
  hasn't published. The second case would mean about 47 requests an hour until ESPN updates.
- Nothing is committed while the data is unchanged, but the request load is the price of the fallback
  that was asked for. If it matters, the fallback slot could be limited to once a day.

---

# Fix round 1 addendum (R16)

Commit: `pipeline: once-a-day gate fallback` (see `git log`). The real network backfill was not rerun.

## Change
- Both gate fallbacks now return `kind=full` with `slot=` set to today's local midnight
  (`2026-10-30T00:00:00+01:00`) instead of the current hour. The two fallbacks are:
  - empty raw/;
  - fixtures left to play, none of them with a future kickoff.
- The workflow skips a slot id that already ran, so each fallback runs at most once per Europe/Rome day.
  This resolves the round-1 concern about hourly full runs.

## Tests
- `test_gate_without_raw_runs_full_once_a_day` (renamed): 12:20 and 23:59 on the same day both give
  `2026-10-30T00:00:00+01:00`.
- `test_gate_runs_full_when_no_fixture_left_has_a_date`: 15:07 and 16:07 give the same midnight slot,
  and 23:30 UTC on 30 Oct (00:30 in Rome) gives `2026-10-31T00:00:00+01:00`.

RED with the old code:
```
$ .venv/bin/python -m pytest tests/test_run.py -q -k gate
2 failed, 2 passed
```
GREEN:
```
$ .venv/bin/python -m pytest tests/test_run.py -q
17 passed in 27.31s
$ .venv/bin/python -m pytest -q
59 passed in 29.68s
```
ruff F/E9 clean.

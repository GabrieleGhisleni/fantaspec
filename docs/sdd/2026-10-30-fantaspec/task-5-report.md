# Task 5 report: Fixtures join and stats

Status: DONE. Commit `8855065 pipeline: fixtures join and stats`.

## What I implemented

- `pipeline/fantaspec/models.py`: added frozen `Fixture(matchday, home, away, kickoff, home_goals, away_goals, completed)`
  (matchday 0 for a past season's match; kickoff UTC or None).
- `pipeline/fantaspec/fixtures.py`: `join_fixtures(calendar, espn, clubs)` returns one `Fixture` per calendar
  fixture, in calendar order, joined on the ordered pair (home key, away key). If ESPN does not list a fixture,
  it gets `kickoff=None`, no score and `completed=False`. ESPN matches outside the calendar, or against a club
  not in `clubs`, are ignored. If ESPN lists the same match twice (from both clubs' schedules), it collapses
  into one.
- `pipeline/fantaspec/stats.py`:
  - `club_stats(...)` builds the `clubs.json` object with every key in the contract: key, name, position,
    points, played, form, gf, ga, home, away, next{opponent, home, kickoff, matchday, h2h}.
  - `player_stats(...)` builds the `players.json` object with every key in the contract: id, name, club, role,
    season{pres, medV, medFV, g, gs, a, cs}, last5{played, g, gs, a, fv}, status, startPct.
- `pipeline/tests/season.py` (new helper module, not a test file) holds the hand-built season that both test
  files import:
  - 5 clubs and 9 calendar fixtures.
  - Lazio-Roma (matchday 3) is postponed, and ESPN keeps its original past date.
  - Roma-Torino (matchday 1) was played late, after matchday 3.
  - Lazio-Juventus (matchday 5) is not on ESPN.
  - The ESPN list has a duplicate match and a match against Milan (not in CLUBS).
  - Players: 9, including an s.v. row, a transfer, a departed player and an unmatched unavailable name.

## How the Definitions rules are applied

- **Pres:** rows with `vote is not None`. **medV/medFV:** `round(statistics.median(...), 2)`, or None when
  pres is 0.
- **g** = goals + pens_scored, **gs** = conceded, **a** = assists. All three are summed over every vote row.
- **cs:** roles P and D only, otherwise None. It counts voted rows where the club on that row conceded 0 in its
  completed fixture of that matchday. The lookup is by `(matchday, row.club)`, so a transferred player's clean
  sheet for his old club counts.
- **last5:**
  - Uses the current club's last (up to) 5 completed fixtures, ordered by kickoff.
  - Each fixture is matched to the player's VoteRow by matchday, whatever club the row is for.
  - `fv` holds None where there is no row. `played` counts rows with a vote.
  - A departed player (club None) gets `fv: []` and zeros.
- **form / gf / ga / home / away:** from the completed fixtures ordered by kickoff, so a postponed match counts
  when it is played.
- **Position / points:** from standings.
- **h2h:** completed meetings from `history + fixtures`, sorted by kickoff, last 5, seen from this club's side.
- **status priority:** suspended > injured > doubtful > warned.
  - Unavailable names are matched with `match_player(name, club, roster)`. Unmatched names are skipped.
  - "doubtful" comes from `LineupEntry.doubtful`, with text `""`.
  - For each kind, the first text seen is kept.
- **Departed player:** name and role come from the VoteRow with the highest matchday; club is None.
- **Players:** roster order first, then departed players sorted by id.

## Design decisions where the brief was silent

1. **`next` with a not-completed fixture whose kickoff is in the past:** it is skipped. `next` is the earliest
   fixture that is not completed and has `kickoff > now`. Fixtures with `kickoff=None` (not on ESPN) are also
   skipped. This covers:
   - a postponed match that ESPN keeps on its original date, which never blocks `next` (Review Focus 5);
   - a postponed match that gets a new date, which becomes `next` again in kickoff order;
   - a match being played when the run happens: `next` already shows the following round, which is also what
     it will show once the match is completed.

   `next.kickoff` is the kickoff converted to Europe/Rome, in ISO format (`2026-10-31T18:00:00+01:00`).
2. **`played` (club) comes from the completed fixtures, not `StandingRow.played`.** This keeps gf/ga per game
   consistent with the goals they divide, and keeps `home.played + away.played == played`. `StandingRow.played`
   is unused.
3. **A club with no standings row raises KeyError.** I did not emit nulls that would break the contract's
   integer types. ESPN standings always list all 20 clubs, so a missing row means a club mapping bug that
   should fail loudly.
4. **`startPct`** is `start_pct` (0 if the player is not listed) only when the club is in the covered set *and*
   `clubs_out[club]["next"]` is not None. Otherwise it is None, which includes departed players. This is the
   only use of `clubs_out` besides choosing which clubs get a last-5 list.
5. **Totals include s.v. rows.** last5 g/gs/a are summed over all matched rows (s.v. included), the same way as
   the season totals.

## Tests

- `tests/test_fixtures.py` (2 tests): the brief's join test, plus calendar order, kickoff/score from ESPN, the
  match played late, and the fixture missing from ESPN.
- `tests/test_stats.py` (9 tests): the brief's 3 tests verbatim, plus:
  - full napoli and Meret objects (contract shape);
  - the postponed-then-next case and form following kickoff order (Review Focus 5);
  - h2h truncated to 5;
  - an s.v. row not counting;
  - the transfer clean sheet and last5;
  - doubtful > warned, and warned alone;
  - covered club with no fixture left → startPct None;
  - the departed player (Review Focus 2);
  - the never-voted player (Review Focus 1, in the brief's test).
- Mutation check: I made 4 temporary changes to stats.py and restored the file each time. The tests catch every
  one:
  - clean sheet using the current club → 1 failure;
  - no `kickoff > now` filter → 1 failure;
  - sorting by matchday instead of kickoff → 3 failures;
  - no last-5 truncation → 1 failure.

### TDD evidence

RED, with only the tests written:
```
$ cd pipeline && .venv/bin/python -m pytest tests/test_fixtures.py tests/test_stats.py -v
E   ImportError: cannot import name 'Fixture' from 'fantaspec.models'
ERROR tests/test_fixtures.py
ERROR tests/test_stats.py
!!!!!!!!!!!!!!!!!!! Interrupted: 2 errors during collection !!!!!!!!!!!!!!!!!!!!
```
This was expected: `Fixture`, `fixtures.py` and `stats.py` did not exist yet.

After adding `Fixture` and `join_fixtures`, `test_fixtures.py` passed (2 passed). `test_stats.py` still failed
with `ModuleNotFoundError: No module named 'fantaspec.stats'`.

GREEN:
```
$ cd pipeline && .venv/bin/python -m pytest tests/test_fixtures.py tests/test_stats.py -v
============================== 11 passed in 0.05s ==============================
$ cd pipeline && .venv/bin/python -m pytest -W error
============================== 26 passed in 1.79s ==============================
```

## Files changed

- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/models.py` (Fixture added)
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/fixtures.py` (new)
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/stats.py` (new)
- `/home/ggabry/projects/fantaspec/pipeline/tests/season.py` (new, shared hand-built data)
- `/home/ggabry/projects/fantaspec/pipeline/tests/test_fixtures.py` (new)
- `/home/ggabry/projects/fantaspec/pipeline/tests/test_stats.py` (new)
- `/home/ggabry/projects/fantaspec/docs/superpowers/plans/2026-10-30-fantaspec.md` (Task 5 steps 1-5 ticked)

## Self-review findings

- I checked every key in the contract for clubs.json and players.json. The full-object equality tests assert
  them.
- Fixed during review:
  - departed players were iterated in set order; they are now sorted;
  - the standings row is now bound once.
- Test output is clean: no warnings, even under `-W error`.

## Concerns (for later tasks, not blocking)

- **Mid-round `startPct` can be stale.** `parse_lineups` returns only the set of covered clubs, not the match
  pairs. If the lineups page still shows a match that was already played, that club counts as covered while its
  `next` is the following round, and `startPct` shows the old percentage. Only match pairs from the parser
  would fix this.
- **Task 7 must build `history` correctly.**
  - It must be built as `Fixture(0, home_key, away_key, kickoff, goals, goals, completed)`.
  - Past opponents that are no longer in the 20-club mapping cannot get a key, so they must be dropped there.
  - `_completed()` sorts by kickoff, so completed history fixtures must have a kickoff (ESPN always gives one).

---

## Fix round 1 (ruling R11): startPct and doubtful only for the club's next match on the page

Commit: `81ca41f pipeline: startPct only for the club's next match on the lineups page`.

This round resolves the review finding, which was also the "Mid-round startPct can be stale" concern above.

### Changes

- **`pipeline/fantaspec/sources/fc_lineups.py`:** `parse_lineups` now returns
  `tuple[list[LineupEntry], set[tuple[str, str]]]`. The second value is the set of (home, away) club pairs of
  the page's match blocks, built by `_match_clubs` as before.
- **Pair order check:** I compared all 10 pairs on the saved page with `parse_calendar(fc_calendar_10.html.gz)`.
  All 10 are in the calendar in home-away order, and none matches reversed. The page order can be trusted, so
  the comparison uses ordered pairs.
  ```
  lineups pairs: [('bologna','monza'), ('udinese','roma'), ('milan','inter'), ('como','venezia'),
                  ('frosinone','torino'), ('lazio','cagliari'), ('lecce','genoa'), ('juventus','napoli'),
                  ('sassuolo','fiorentina'), ('atalanta','parma')]
  in calendar ordered:  [True]*10
  reversed in calendar: [False]*10
  ```
- **`pipeline/tests/test_fc_lineups.py`:**
  - `test_lineups_structure` now derives the club count from the pairs:
    `len({c for pair in pairs for c in pair}) >= 18`.
  - `test_lineups_values` now asserts `{("bologna", "monza"), ("juventus", "napoli")} <= pairs` (home-away),
    instead of the old club-set check.
  - All other assertions are unchanged.
- **`pipeline/fantaspec/stats.py`, `player_stats`:**
  - The `lineups` type hint is now `tuple[list[LineupEntry], set[tuple[str, str]]]`, and the docstring explains
    the rule.
  - A club is "on the page" when the (home, away) pair of its `clubs_out[club]["next"]` is in the page's pairs.
    The new helper `_next_pair` derives that pair from `opponent` and `home`.
  - Only lineup entries of players whose roster club is on the page are used, both for `startPct` (entry value,
    or 0 if not listed) and for the lineup-derived `doubtful` status.
  - Otherwise `startPct` is null and the page adds no `doubtful`.
  - Statuses from the unavailable page are unaffected.
- **`pipeline/tests/season.py`:**
  - `LINEUPS` now holds pairs: `{("juventus", "napoli"), ("roma", "torino")}`.
  - `roma-torino` is a match already played. Roma's next match is roma-lazio, and Torino has no fixture left.
  - Added `LineupEntry(777, "Dybala", "roma", 70, True)` as the stale entry.
- **`pipeline/tests/test_stats.py`:** new test `test_lineups_page_counts_only_for_the_clubs_next_match`.
  - With roma's played match on the page: 777 gets `startPct` None and `status` None.
  - With the postponed `("lazio", "roma")` on the page: 777 still gets None. This checks that order matters,
    since roma's next match is roma-lazio.
  - With `("roma", "lazio")` on the page: 777 gets 70 and doubtful, while napoli players get None and no
    doubtful.
  - The brief's verbatim tests are unchanged and still pass. 777 is null because roma's *next* match is not on
    the page.

### TDD evidence

RED: I updated the season data and added the new test, with the old stats code still in place.
```
$ cd pipeline && .venv/bin/python -m pytest tests/test_fc_lineups.py tests/test_stats.py -q
FAILED tests/test_stats.py::test_player_status_and_start_pct - assert None == 95
FAILED tests/test_stats.py::test_player_full_object_and_population - Assertio...
FAILED tests/test_stats.py::test_lineups_page_counts_only_for_the_clubs_next_match
3 failed, 10 passed
```
This failure was expected: the old code tested `club in covered` against a set of pairs. The parser's
return-type change was made just before its test update. It is a refactor of the return value, and the updated
lineups tests pass against the saved page.

GREEN:
```
$ cd pipeline && .venv/bin/python -m pytest tests/test_fc_lineups.py tests/test_stats.py -q
13 passed in 0.71s
$ cd pipeline && .venv/bin/python -m pytest -W error
============================== 27 passed in 1.77s ==============================
```

### Notes for later tasks

- The plan text for Tasks 4 and 5 still says that the lineups page returns `set[str]`. The code is now
  `set[tuple[str, str]]`. I did not edit the plan's interface text.
- Task 7 must store the pairs in `raw/` as JSON lists and turn them back into tuples before calling
  `player_stats`.

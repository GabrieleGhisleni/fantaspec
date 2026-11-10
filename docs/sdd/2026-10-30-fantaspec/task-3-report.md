# Task 3 report: fantacalcio.it parsers (votes, roster, calendar)

Status: DONE_WITH_CONCERNS
Commit: 425e4f8 pipeline: fantacalcio votes, roster and calendar parsers

## What I implemented

- `pipeline/fantaspec/models.py`: added frozen dataclasses `VoteRow`, `RosterPlayer`, `CalendarFixture` with the
  fields and order from the brief.
- `pipeline/fantaspec/sources/fc_roster.py`
  - `parse_player_link(row)`: finds the row's `a.player-name[href]` link, matches
    `/serie-a/squadre/<club>/<slug>/<id>`, returns `(id, name, club)` or `None`. The votes parser uses it too.
  - `parse_roster(html)`: one `RosterPlayer` per `tr[data-filter-role-classic]` with a player link. The role is that
    attribute upper-cased. The fixture gives 603 players, all 20 clubs, unique ids.
- `pipeline/fantaspec/sources/fc_votes.py`: `parse_votes(html, matchday)`
  - One row per `tr` with a player link. Coach rows have a plain `span.player-name` and no link, so they are skipped.
  - Role comes from `span.role[data-value]`, upper-cased. Vote and fantavote come from the first `.pill`
    (Redazione Fantacalcio), as comma decimals.
  - Bonus cells are read by `title`. A missing title raises `KeyError` on purpose, so a page change fails loudly.
- `pipeline/fantaspec/sources/fc_calendar.py`: `parse_calendar(html, matchday)`
  - Matches links `calendario/<md>/<season>/<home>-<away>/<id>`, both absolute and relative, and keeps those of the
    requested matchday.
  - Splits `<home>-<away>` by trying every `clubs.by_key()` key as the prefix, then removes duplicates while keeping
    page order (each fixture appears twice on the page).
  - A pair it cannot split is skipped.
- Tests: `pipeline/tests/test_fc_votes.py`, `test_fc_roster.py`, `test_fc_calendar.py`. They contain the brief's
  tests (see the deviation below) plus one extra votes test.
- Plan: ticked Task 3 Steps 2 to 6 in `docs/superpowers/plans/2026-10-30-fantaspec.md`.

## Deviations from the brief (please review)

1. **Votes count is 316, not 305.** The saved votes page has 316 player rows across 20 clubs: 16 clubs with 16 players
   and 4 clubs with 15. All 316 have unique ids.
   - 11 player hrefs have accented slugs that the raw HTML stores as entities, for example
     `squadre/roma/soul&#xE8;/5734`.
   - A regex over the raw HTML with an ASCII slug pattern finds exactly 305. Allowing any slug finds 316, which proves
     where 305 came from.
   - The 11 missing players are Zè Pedro, Dodò, Calò, Traorè HJ, Lucumì, Cissè A, Bernabè, Tourè E, Soulè, Candè and
     Laurientè. Excluding them would silently drop their votes.
   - I changed the assertion to `== 316` with a comment, and added `test_votes_accented_slug_and_senza_voto`. It
     asserts that Soulè (5734) is parsed as `("Soulè", "roma")`.
   - The design spec (line 64, "Matchday 8 had 305 players") repeats the wrong number. I left the spec unchanged.
2. **s.v. is the numeric code `55`, not a non-numeric value.**
   - 25 rows have `data-value="55"` in the first pill for both the vote and the fantavote. Example: Vitik (7068), who
     came on as a substitute.
   - Some rows mix it with real votes in the other pills, for example Cutrone `55 / 6 / 6`.
   - It is fantacalcio.it's "senza voto" code. Taking it literally would give a "vote" of 55 and corrupt the
     Pres/MedV/MedFV statistics (the spec says s.v. does not count).
   - `_grade` maps 55 to `None`, alongside non-numeric values. The extra test asserts Vitik's vote and fantavote are
     `(None, None)`.
   - I checked that this test fails without the guard: Vitik's vote comes out as 55.0.

## TDD evidence

RED. I wrote the tests first and ran
`cd pipeline && .venv/bin/python -m pytest tests/test_fc_votes.py tests/test_fc_roster.py tests/test_fc_calendar.py -v`:
```
E   ModuleNotFoundError: No module named 'fantaspec.sources.fc_votes'
E   ImportError: cannot import name 'RosterPlayer' from 'fantaspec.models'
E   ImportError: cannot import name 'CalendarFixture' from 'fantaspec.models'
!!!!!!!!!!!!!!!!!!! Interrupted: 3 errors during collection !!!!!!!!!!!!!!!!!!!!
```
This was expected because the modules and dataclasses did not exist yet.

After implementing, the same command with the brief's verbatim `305`:
```
tests/test_fc_votes.py::test_votes_matchday_8 FAILED
E       AssertionError: assert 316 == 305
========================= 1 failed, 3 passed in 1.18s ==========================
```
Investigation (deviation 1) showed 305 is a miscount, so I changed the assertion to 316.

GREEN, same command:
```
tests/test_fc_votes.py::test_votes_matchday_8 PASSED
tests/test_fc_votes.py::test_votes_accented_slug_and_senza_voto PASSED
tests/test_fc_roster.py::test_roster PASSED
tests/test_fc_calendar.py::test_calendar_matchday_10 PASSED
============================== 4 passed in 1.15s ===============================
```

Full suite, `cd pipeline && .venv/bin/python -m pytest -q`: `7 passed in 1.20s`, no warnings.

## Sanity checks on the parsed fixtures (not in the tests)

- Votes:
  - Roles are 20 P, 119 D, 119 C and 58 A, so one goalkeeper per club.
  - 25 rows have a `None` vote and fantavote.
  - The highest vote is 8.5 and the highest fantavote is 15.5.
  - Every `matchday` is 8.
  - Club slugs are exactly the 20 keys in `clubs.json`.
- Roster: 603 players, including `RosterPlayer(5734, "Soulè", "roma", "A")`.
- Calendar, matchday 10: 10 fixtures, all valid club keys. Asking for matchday 9 on this page returns `[]`.

## Files changed

- /home/ggabry/projects/fantaspec/pipeline/fantaspec/models.py
- /home/ggabry/projects/fantaspec/pipeline/fantaspec/sources/fc_votes.py (new)
- /home/ggabry/projects/fantaspec/pipeline/fantaspec/sources/fc_roster.py (new)
- /home/ggabry/projects/fantaspec/pipeline/fantaspec/sources/fc_calendar.py (new)
- /home/ggabry/projects/fantaspec/pipeline/tests/test_fc_votes.py (new)
- /home/ggabry/projects/fantaspec/pipeline/tests/test_fc_roster.py (new)
- /home/ggabry/projects/fantaspec/pipeline/tests/test_fc_calendar.py (new)
- /home/ggabry/projects/fantaspec/docs/superpowers/plans/2026-10-30-fantaspec.md (Task 3 checkboxes only)

## Self-review

- Every interface matches the brief: the signatures, the dataclass fields and their order, `P/D/C/A` roles and club
  slugs as keys.
- Shared link parsing: `parse_player_link` lives in `fc_roster.py` and `fc_votes.py` imports it. This keeps the file
  structure from the plan with no new module, and avoids duplicating the regex. Task 4 (`names.py`, lineups) may want
  to reuse it.
- Error handling: missing role, pill or bonus cells raise exceptions instead of producing silent zeros. The calendar
  parser skips a `<home>-<away>` pair it cannot split.
- BeautifulSoup decodes entities, so accented names and slugs come out as real Unicode (`Soulè`).
- Fixtures were not modified. I worked on decompressed copies in the scratchpad only.

## Concerns

- The 305 → 316 change and the s.v. code 55 change go against the brief's verbatim wording. The evidence is above.
  The design spec's "305 players" note (line 64) is still wrong. Updating it was not part of this task.
- Downstream tasks should treat `VoteRow.vote is None` as s.v. (it does not count towards Pres).

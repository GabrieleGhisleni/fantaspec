# Task 6 report: Update slots and the gate

**Status:** DONE
**Commit:** `5c79a32 pipeline: update slots and gate`

## What I implemented

`pipeline/fantaspec/schedule.py`:
- `Slot(at: datetime, kind: str)`: frozen dataclass. `at` is aware in Europe/Rome, `kind` is `light` or `full` (the module constants `LIGHT`/`FULL`).
- `slots(fixtures) -> list[Slot]`: each fixture's local date is `kickoff.astimezone(TZ).date()`. Fixtures with `kickoff is None` are skipped. The rules are the brief's:
  - every match day gets 10:00 light and 23:30 full;
  - for each matchday's first match day F, F-2 and F-1 get 09:00 and 19:00 light, unless that day has matches;
  - for each match day D whose next day is free, D+1 gets 12:00 full, and D+2 also gets 12:00 full if it is free too.

  Each slot is built with `datetime.combine(d, t, tzinfo=TZ)` and collected in a dict keyed by time, where `full` is never replaced by `light`. The output is sorted.
- `due(now, slots, grace=90 min) -> Slot | None`: the latest slot with `0 <= now - slot.at < grace`. Mixing UTC `now` with Rome `at` works because aware subtraction goes through UTC.

`pipeline/tests/test_schedule.py`:
- Has the helpers `rome()` and `utc()`, plus `match()`, which builds an unplayed `Fixture` with its kickoff converted to UTC the way ESPN stores it.
- Test data:
  - ROUND_10_AND_11: 10 matches over Sat 31 Oct, Sun 1 Nov and Mon 2 Nov, then round 11 on Sat 7 and Sun 8 Nov.
  - ROUND_8_SUN_25_OCT: all on Sun 25 Oct, the day of the CEST to CET switch.
  - ROUND_9_WED_28_OCT: the midweek round.
- Contains the brief's three tests verbatim, plus one extra: `test_slots_use_the_local_date_and_skip_matches_without_kickoff`. It uses a match at 23:30 UTC on Sat 21 Nov (00:30 Sun 22 in Rome) and a match with no kickoff, and asserts the exact sorted list of 8 slots.

Plan: ticked Task 6 Steps 1–5 in `docs/superpowers/plans/2026-10-30-fantaspec.md` and included that in the commit.

## TDD evidence

RED: `cd pipeline && .venv/bin/python -m pytest tests/test_schedule.py -v`
```
E   ModuleNotFoundError: No module named 'fantaspec.schedule'
ERROR tests/test_schedule.py
=============================== 1 error in 0.09s ===============================
```
This failure was expected because `schedule.py` did not exist yet.

GREEN: same command
```
tests/test_schedule.py::test_slots_for_a_normal_week PASSED
tests/test_schedule.py::test_due_with_delay_and_dst PASSED
tests/test_schedule.py::test_midweek_round_overlap_and_dst PASSED
tests/test_schedule.py::test_slots_use_the_local_date_and_skip_matches_without_kickoff PASSED
============================== 4 passed in 0.03s ===============================
```

Mutation check: I temporarily replaced `f.kickoff.astimezone(TZ).date()` with `f.kickoff.date()`, which uses the UTC date. The extra test failed (`1 failed, 3 passed`) and the brief's three still passed, which shows the extra test is needed. I then restored the file.

Full suite: `cd pipeline && .venv/bin/python -m pytest`, result `31 passed in 1.79s`, with no warnings.

## Files changed

- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/schedule.py` (new)
- `/home/ggabry/projects/fantaspec/pipeline/tests/test_schedule.py` (new)
- `/home/ggabry/projects/fantaspec/docs/superpowers/plans/2026-10-30-fantaspec.md` (Task 6 checkboxes)

## Self-review

- **DST (Review Focus 4):** every slot time (09:00, 10:00, 12:00, 19:00, 23:30) is outside the 02:00–03:00 transition hour, so `combine(..., tzinfo=TZ)` is never ambiguous and never falls in a gap. Equal aware datetimes with the same tzinfo compare on wall time, so the dict keys and the sorting stay consistent. The tests cover both sides of the 25 Oct switch, CEST on 24 Oct and CET on 25 Oct.
- **Late trigger:** a trigger up to 90 minutes late is covered and tested, both 37 minutes late (runs) and 97 minutes late (skipped).
- **Doubled trigger:** a second trigger within grace gets the same slot back from `due`. That this second run "commits nothing" depends on the write-if-changed logic in build/run, a later task.
- **"Same time, full wins":** implemented as the interface asks. With the current rules it can't actually happen: match days only get 10:00 and 23:30, other days only get 09:00, 12:00 and 19:00, so two slots at the same time always have the same kind. Duplicates do occur, for example when two matchdays start on the same day, and the dict collapses them.
- **YAGNI:** fixtures with matchday 0 (head-to-head history) are not filtered out. `stats.club_stats` takes history as a separate list, so the gate is only ever given the season's fixtures.
- In `due`, the parameter is named `slots` as the interface requires. It shadows the module function inside `due`, which doesn't matter because `due` never calls `slots()`.

## Concerns

None blocking. One note for the workflow task: with cron at minute 7, the 23:30 slot actually runs at about 00:07 Rome time, 37 minutes after the slot. This is intended and tested.

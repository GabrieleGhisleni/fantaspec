### Task 6: Update slots and the gate

**Files:**
- Create: `pipeline/fantaspec/schedule.py`
- Test: `pipeline/tests/test_schedule.py`

**Interfaces:**
- Consumes: `Fixture`, `config.TZ`.
- Produces: `Slot(at: datetime, kind: str)` (`at` aware in Europe/Rome, kind `light` or `full`); `schedule.slots(fixtures: list[Fixture]) -> list[Slot]` sorted and de-duplicated (same time → `full` wins); `schedule.due(now: datetime, slots: list[Slot], grace: timedelta = timedelta(minutes=90)) -> Slot | None` (latest slot with `0 <= now - slot.at < grace`).

Slot rules (spec "Update schedule"), computed per local date:
- Every date with at least one fixture: 10:00 `light`, 23:30 `full`.
- For each matchday, its first fixture date F: F−2 and F−1 at 09:00 and 19:00 `light`, unless that date has fixtures.
- For each fixture date D whose next day has no fixture: D+1 at 12:00 `full`; and D+2 at 12:00 `full` if D+1 and D+2 have no fixtures.

- [ ] **Step 1: Write the failing tests** (round 10 on Sat 31 Oct, Sun 1 Nov, Mon 2 Nov; round 11 starting Sat 7 Nov):

```python
def test_slots_for_a_normal_week():
    s = slots(ROUND_10_AND_11)
    window = [x for x in s if date(2026, 10, 29) <= x.at.date() <= date(2026, 11, 7)]
    assert len(window) == 18
    assert Slot(rome(2026, 10, 29, 9, 0), "light") in window
    assert Slot(rome(2026, 10, 31, 23, 30), "full") in window
    assert Slot(rome(2026, 11, 3, 12, 0), "full") in window
    assert Slot(rome(2026, 11, 4, 12, 0), "full") in window
    assert not any(x.at.date() == date(2026, 11, 4) and x.at.hour != 12 for x in window)

def test_due_with_delay_and_dst():
    s = slots(ROUND_10_AND_11)
    assert due(utc(2026, 10, 31, 23, 7), s).at == rome(2026, 10, 31, 23, 30)   # 23:30 CET = 22:30 UTC, 37 min late
    assert due(utc(2026, 11, 1, 0, 7), s) is None                               # 97 min late, outside grace
    assert due(utc(2026, 11, 4, 20, 7), s) is None                              # quiet evening

def test_midweek_round_overlap_and_dst():
    s = slots(ROUND_8_SUN_25_OCT + ROUND_9_WED_28_OCT)
    assert Slot(rome(2026, 10, 26, 9, 0), "light") in s and Slot(rome(2026, 10, 26, 12, 0), "full") in s
    assert due(utc(2026, 10, 24, 17, 7), s).at == rome(2026, 10, 24, 19, 0)    # Sat 24: CEST, 19:00 = 17:00 UTC
    assert due(utc(2026, 10, 25, 9, 7), s).at == rome(2026, 10, 25, 10, 0)     # Sun 25: CET after the switch, 10:00 = 09:00 UTC
```
`rome(...)` and `utc(...)` are test helpers building aware datetimes.

- [ ] **Step 2: Run** `python -m pytest tests/test_schedule.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** `slots` and `due` with `zoneinfo`; build each slot from a local date and time with `datetime.combine(d, t, tzinfo=TZ)`.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "pipeline: update slots and gate"`.

---


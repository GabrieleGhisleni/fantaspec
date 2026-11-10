### Task 5: Fixtures join and stats

**Files:**
- Create: `pipeline/fantaspec/fixtures.py`, `pipeline/fantaspec/stats.py`; extend `models.py`
- Test: `pipeline/tests/test_fixtures.py`, `pipeline/tests/test_stats.py` (hand-built inputs, no saved pages)

**Interfaces:**
- Consumes: `Club`, `EspnMatch`, `StandingRow`, `CalendarFixture`, `VoteRow`, `RosterPlayer`, `LineupEntry`, `Unavailable`, `match_player`.
- Produces:
  - `Fixture(matchday: int, home: str, away: str, kickoff: datetime | None, home_goals: int | None, away_goals: int | None, completed: bool)`
  - `fixtures.join_fixtures(calendar: list[CalendarFixture], espn: list[EspnMatch], clubs: list[Club]) -> list[Fixture]` — join on the ordered pair (home key, away key), unique per season.
  - `stats.club_stats(fixtures: list[Fixture], standings: list[StandingRow], history: list[Fixture], clubs: list[Club], now: datetime) -> dict[str, dict]` → the `clubs.json` object of the data contract.
  - `stats.player_stats(roster: list[RosterPlayer], votes: list[VoteRow], fixtures: list[Fixture], lineups: tuple[list[LineupEntry], set[str]], unavailable: list[Unavailable], clubs_out: dict[str, dict]) -> dict[str, dict]` → the `players.json` object.
  - `history` is a list of `Fixture` from past seasons (matchday 0) used only for head to head.

- [ ] **Step 1: Write the failing tests** with a small hand-built season (4 clubs, 6 fixtures, a few vote rows):

```python
def test_join_keeps_unplayed_and_postponed():
    fx = join_fixtures(CAL, ESPN, CLUBS)
    assert len(fx) == len(CAL)
    postponed = next(f for f in fx if (f.home, f.away) == ("lazio", "roma"))
    assert postponed.matchday == 3 and postponed.completed is False

def test_club_stats_form_split_and_next():
    out = club_stats(FX, STANDINGS, HISTORY, CLUBS, now=NOW)
    nap = out["napoli"]
    assert nap["form"] == ["W", "D", "L"]            # oldest -> newest
    assert (nap["gf"], nap["ga"]) == (4, 3)
    assert nap["home"] == {"played": 2, "gf": 3, "ga": 1}
    assert nap["next"]["opponent"] == "juventus" and nap["next"]["home"] is False
    assert nap["next"]["h2h"] == ["L", "W", "D"]     # from napoli's side, history + this season
    assert out["torino"]["next"] is None             # no fixture left

def compute():
    return player_stats(ROSTER, VOTES, FX, LINEUPS, UNAVAIL, club_stats(FX, STANDINGS, HISTORY, CLUBS, now=NOW))

def test_player_stats_keeper_and_unvoted():
    out = compute()
    meret = out["572"]
    assert meret["season"]["pres"] == 3 and meret["season"]["medFV"] == 6.0
    assert meret["season"]["gs"] == 3 and meret["season"]["cs"] == 1
    assert meret["last5"]["fv"] == [7.0, 6.0, 5.0]
    bench = out["999"]                                # in roster, never voted
    assert bench["season"]["pres"] == 0 and bench["season"]["medV"] is None
    assert bench["last5"]["fv"] == [None, None, None] and bench["last5"]["played"] == 0
    assert out["123"]["season"]["g"] == 2             # 1 goal + 1 penalty
    assert out["123"]["season"]["cs"] is None         # role C

def test_player_status_and_start_pct():
    out = compute()
    assert out["572"]["startPct"] == 95
    assert out["888"]["startPct"] == 0               # club covered, player not listed
    assert out["777"]["startPct"] is None            # club not covered
    assert out["555"]["status"] == {"kind": "suspended", "text": UNAVAIL_555_SUSPENDED.text}   # also listed injured; suspended wins
    assert out["444"]["club"] is None                 # voted earlier, no longer in roster
```

- [ ] **Step 2: Run** `python -m pytest tests/test_fixtures.py tests/test_stats.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** following the spec's Definitions section and the data contract. Medians with `statistics.median`, rounded to 2 decimals. "Last 5" uses the club's last 5 completed fixtures by kickoff and the player's `VoteRow` for each fixture's matchday (any club, so transfers work). Clean sheet: player had a vote and the club conceded 0 in that fixture (roles P and D only). Positions and points come from `standings`; form, goals and splits from fixtures. Head to head: completed meetings from `history` + this season, last 5 by kickoff.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "pipeline: fixtures join and stats"`.

---


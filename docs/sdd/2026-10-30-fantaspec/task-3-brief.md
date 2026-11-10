### Task 3: fantacalcio.it parsers with ids (votes, roster, calendar)

**Files:**
- Create: `pipeline/fantaspec/sources/fc_votes.py`, `fc_roster.py`, `fc_calendar.py`; extend `models.py`
- Test: `pipeline/tests/test_fc_votes.py`, `test_fc_roster.py`, `test_fc_calendar.py`; fixtures `fc_votes_8.html.gz`, `fc_roster.html.gz`, `fc_calendar_10.html.gz`

**Interfaces:**
- Consumes: `config.fc_*_url`, `clubs.by_key()`.
- Produces:
  - `VoteRow(player_id: int, name: str, club: str, role: str, matchday: int, vote: float | None, fanta_vote: float | None, goals: int, conceded: int, own_goals: int, pens_scored: int, pens_missed: int, pens_saved: int, assists: int)`
  - `RosterPlayer(id: int, name: str, club: str, role: str)`
  - `CalendarFixture(matchday: int, home: str, away: str)`
  - `fc_votes.parse_votes(html: str, matchday: int) -> list[VoteRow]`
  - `fc_roster.parse_roster(html: str) -> list[RosterPlayer]`
  - `fc_calendar.parse_calendar(html: str, matchday: int) -> list[CalendarFixture]`

- [x] **Step 1: Save the pages.** Already saved on 2026-10-30: `fc_votes_8.html.gz`, `fc_roster.html.gz`, `fc_calendar_10.html.gz` (10 fixtures) in `pipeline/tests/fixtures/`.
- [ ] **Step 2: Write the failing tests**

```python
def test_votes_matchday_8():
    rows = parse_votes(load_fixture("fc_votes_8.html.gz"), 8)
    assert len(rows) == 305
    assert len({r.club for r in rows}) == 20
    meret = next(r for r in rows if r.player_id == 572)
    assert (meret.name, meret.club, meret.role, meret.vote, meret.fanta_vote, meret.conceded) == ("Meret", "napoli", "P", 6.5, 3.5, 3)
    bernardeschi = next(r for r in rows if r.player_id == 184)
    assert (bernardeschi.vote, bernardeschi.goals, bernardeschi.pens_scored) == (7.0, 0, 1)

def test_roster():
    players = parse_roster(load_fixture("fc_roster.html.gz"))
    assert len(players) >= 500
    assert RosterPlayer(572, "Meret", "napoli", "P") in players
    assert {p.role for p in players} == {"P", "D", "C", "A"}

def test_calendar_matchday_10():
    fx = parse_calendar(load_fixture("fc_calendar_10.html.gz"), 10)
    assert len(fx) == 10
    assert CalendarFixture(10, "juventus", "napoli") in fx
    assert CalendarFixture(10, "milan", "inter") in fx
```

- [ ] **Step 3: Run** `python -m pytest tests/test_fc_votes.py tests/test_fc_roster.py tests/test_fc_calendar.py -v`. Expected: FAIL.
- [ ] **Step 4: Implement the three parsers** with BeautifulSoup (`html.parser`).
  - Votes: one row per `tr` containing `a.player-name` with href `/serie-a/squadre/<club>/<slug>/<id>`; skip rows without that link (coaches). Role from `span.role[data-value]` upper-cased. Vote and fantavote from the first `.pill` (`.player-grade` / `.player-fanta-grade`, `data-value` with comma decimal); a non-numeric value means `None`. Bonus cells `.player-bonus[data-value]` by `title`: `Gol segnati`, `Gol subiti`, `Autoreti`, `Rigori segnati`, `Rigori sbagliati`, `Rigori parati`, `Assist`.
  - Roster: rows carry `data-filter-role-classic="p"` and the same player link; club from the link.
  - Calendar: links `calendario/<md>/<season>/<home>-<away>/<id>` filtered to the requested matchday; split `<home>-<away>` by trying every known club key as the prefix, de-duplicated.
- [ ] **Step 5: Run the tests again.** Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "pipeline: fantacalcio votes, roster and calendar parsers"`.

---


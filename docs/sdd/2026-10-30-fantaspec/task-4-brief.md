### Task 4: Lineups, unavailable players and name matching

**Files:**
- Create: `pipeline/fantaspec/sources/fc_lineups.py`, `fc_unavailable.py`, `pipeline/fantaspec/names.py`; extend `models.py`
- Test: `pipeline/tests/test_fc_lineups.py`, `test_fc_unavailable.py`, `test_names.py`; fixtures `fc_lineups.html.gz`, `fc_unavailable.html.gz`

**Interfaces:**
- Consumes: `RosterPlayer`.
- Produces:
  - `LineupEntry(player_id: int, name: str, club: str, start_pct: int, doubtful: bool)`; `fc_lineups.parse_lineups(html: str) -> tuple[list[LineupEntry], set[str]]` (entries, and the club keys covered by the page).
  - `Unavailable(club: str, name: str, kind: str, text: str)` with kind `injured` | `suspended` | `warned`; `fc_unavailable.parse_unavailable(html: str) -> list[Unavailable]`.
  - `names.match_player(name: str, club: str, roster: list[RosterPlayer]) -> int | None`.

- [x] **Step 1: Save both pages.** Already saved on 2026-10-30: `fc_lineups.html.gz`, `fc_unavailable.html.gz` in `pipeline/tests/fixtures/`.
- [ ] **Step 2: Write the failing tests.** Besides the assertions below, pick one starter, one ballottaggio player and one injured player visible in the saved pages and assert their exact values.

```python
def test_lineups_structure():
    entries, clubs = parse_lineups(load_fixture("fc_lineups.html.gz"))
    assert len(clubs) >= 18
    assert len(entries) >= 300
    assert all(0 <= e.start_pct <= 100 for e in entries)
    assert any(e.doubtful for e in entries)

def test_unavailable_structure():
    items = parse_unavailable(load_fixture("fc_unavailable.html.gz"))
    assert {i.kind for i in items} <= {"injured", "suspended", "warned"}
    assert all(i.club in by_key() for i in items)
    assert not any(i.name.lower().startswith("nessun") for i in items)

def test_match_player():
    roster = [RosterPlayer(1, "Miranda J.", "bologna", "D"), RosterPlayer(2, "N'Dicka", "roma", "D"),
              RosterPlayer(3, "Martinez L.", "inter", "A"), RosterPlayer(4, "Martinez Jo.", "inter", "P")]
    assert match_player("Miranda J.", "bologna", roster) == 1
    assert match_player("N’Dicka", "roma", roster) == 2
    assert match_player("Lautaro Martinez", "inter", roster) is None
    assert match_player("Martinez L.", "inter", roster) == 3
    assert match_player("Miranda", "roma", roster) is None
```

- [ ] **Step 3: Run the tests.** Expected: FAIL.
- [ ] **Step 4: Implement.**
  - Lineups: per match block, starters and bench each carry a name link (player id) and a `NN%`; a player in a "ballottaggio" pair is `doubtful=True`. Covered clubs are the two clubs of every match block.
  - Unavailable: per club section, the `Infortunati`, `Squalificati`, `Diffidati` lists; each entry's first word(s) are the name, the rest is `text`; "Nessuno"/"Nessun calciatore" means an empty list.
  - `match_player`: normalise (lower case, strip accents, unify apostrophes, drop dots), only within the same club; exact normalised match first, then a unique surname match; ambiguous or missing → `None`.
- [ ] **Step 5: Run the tests again.** Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "pipeline: lineups, unavailable and name matching"`.

---


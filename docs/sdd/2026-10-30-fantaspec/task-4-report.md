# Task 4 report: Lineups, unavailable players and name matching

Status: DONE. Commit `aa17e0b pipeline: lineups, unavailable and name matching`.

## What I implemented

- `pipeline/fantaspec/models.py`: added `LineupEntry(player_id, name, club, start_pct, doubtful)` and
  `Unavailable(club, name, kind, text)`. Both are frozen dataclasses, like the other models.
- `pipeline/fantaspec/sources/fc_lineups.py`: `parse_lineups(html) -> (entries, clubs)`.
  - Match blocks are `li.match-item` (the page also has 10 bare `li.match` nav pills, which are skipped).
  - Covered clubs come from the header links `label.team-home|team-away a.team-link` (`/serie-a/squadre/<slug>`).
  - Entries come from `.team-card .player-list li.player-item` (both `starters` and `reserves`). The id, name
    and club come from `parse_player_link` (imported from `fc_roster`), and the percentage from the
    `.progress-value` text (`NN%`).
  - `doubtful` is true when the player's id appears in any `.ballot-list` of the same match. A ballot list
    can also contain an `li.comment` without a link; it is skipped.
  - Fails loudly with `ValueError` in these cases: no match blocks; a missing home or away club link; a
    player row without a link or a valid `NN%` (0–100); a player whose link club isn't one of the match's
    two clubs.
  - The pitch graphic (`.pitch`) duplicates the starters, and the per-match injured, suspended and warned
    lists also contain player links. Neither is used.
- `pipeline/fantaspec/sources/fc_unavailable.py`: `parse_unavailable(html) -> list[Unavailable]`.
  - One `div.card.team-card` per club. The display name in `.team-name` is mapped to the club key through
    the `clubs.json` names (case-insensitive). An unknown name raises `ValueError`.
  - Each `.col` is read in order: a `header` (Infortunati / Squalificati / Diffidati → injured /
    suspended / warned), then a `ul` of items or a `.empty-list-message` ("Nessuno").
  - Unknown headings or unexpected elements raise `ValueError`.
  - Note: on this page the name and the note are separate elements (`strong.item-name` and
    `.item-description`). So the name is the full `item-name` text and `text` is the description with its
    whitespace collapsed (`&nbsp;` removed), or `""` when there is no description (all 3 warned players).
    No word splitting was needed.
- `pipeline/fantaspec/names.py`: `normalise(name)` (lower case, accents stripped via NFKD,
  ’ ‘ ʼ ` ´ turned into ', dots dropped, whitespace collapsed) and `match_player(name, club, roster)`.
  - Only players of the same club are considered.
  - An exact normalised match comes first, then a surname match. The surname is the name without
    initials, where an initial is any word ending in "." (so "Martinez Jo." becomes "martinez").
  - More than one hit at either step returns `None`, and so does no hit.
- Plan: ticked Task 4 Steps 2–6 in `docs/superpowers/plans/2026-10-30-fantaspec.md` (Step 1 was already
  ticked).

## Tests

- `tests/test_fc_lineups.py`
  - The brief's `test_lineups_structure`.
  - `test_lineups_values`:
    - starter `LineupEntry(133, "Skorupski", "bologna", 90, False)`
    - bench ballottaggio player `LineupEntry(7212, "Heggem", "bologna", 40, True)`
    - starter ballottaggio player `LineupEntry(5498, "Casale", "bologna", 60, True)`
    - De Silvestri (487), who is only in the match's injured list, is not an entry
    - player ids are unique
  - `test_lineups_rejects_unknown_markup`.
- `tests/test_fc_unavailable.py`
  - The brief's `test_unavailable_structure`.
  - `test_unavailable_values`:
    - injured `Unavailable("atalanta", "Kessiè", "injured", "L'ivoriano condizionato … inizio novembre.")`.
      The accent comes from an HTML entity in the page, so this also checks entity decoding.
    - suspended `Unavailable("lecce", "Gaspar K.", "suspended", "squalificato nella 10a giornata di campionato")`
    - warned `Unavailable("cagliari", "Deiola", "warned", "")`
    - 87 items in total
  - `test_unavailable_rejects_unknown_markup`: an empty page, and a card for an unknown club ("Pisa").
- `tests/test_names.py`
  - The brief's `test_match_player`.
  - `test_match_player_normalisation_and_surname`:
    - accent and case: "KESSIÈ" matches roster "Kessie"
    - the query has no initial: "Pellegrini" matches "Pellegrini Lo."
    - the query has an initial the roster lacks: "Thuram K." matches "Thuram"
    - a club with no candidates returns None

### TDD evidence

RED, run before any implementation existed:
`cd pipeline && .venv/bin/python -m pytest tests/test_fc_lineups.py tests/test_fc_unavailable.py tests/test_names.py`
```
E   ImportError: cannot import name 'LineupEntry' from 'fantaspec.models'
E   ImportError: cannot import name 'Unavailable' from 'fantaspec.models'
E   ModuleNotFoundError: No module named 'fantaspec.names'
ERROR tests/test_fc_lineups.py
ERROR tests/test_fc_unavailable.py
ERROR tests/test_names.py
!!!!!!!!!!!!!!!!!!! Interrupted: 3 errors during collection !!!!!!!!!!!!!!!!!!!!
```
This failure was expected: the models, parsers and the `names` module did not exist yet.

GREEN, the same command after implementing: `6 passed in 0.77s`.

Full suite (`cd pipeline && .venv/bin/python -m pytest`), after adding the two reject-markup tests:
`15 passed in 1.75s`, with no warnings.

### Extra checks on the real data (not committed as tests)

- Lineups: 454 entries, 20 clubs, 74 doubtful, no duplicate ids. Every ballot player is also in the
  starters or bench of their match.
- Unavailable: 87 items (82 injured, 2 suspended, 3 warned). All 87 names match a roster id from
  `fc_roster.html.gz` through `match_player`.
- Running each lineup name through `match_player` gives back its own id, except for 9 bench players
  (e.g. Vinciati 7652, Pellegri 2103, Konate A. 7581). Their ids are absent from the quotazioni roster
  altogether, so `None` is correct.

## Files changed

- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/models.py` (extended)
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/sources/fc_lineups.py` (new)
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/sources/fc_unavailable.py` (new)
- `/home/ggabry/projects/fantaspec/pipeline/fantaspec/names.py` (new)
- `/home/ggabry/projects/fantaspec/pipeline/tests/test_fc_lineups.py` (new)
- `/home/ggabry/projects/fantaspec/pipeline/tests/test_fc_unavailable.py` (new)
- `/home/ggabry/projects/fantaspec/pipeline/tests/test_names.py` (new)
- `/home/ggabry/projects/fantaspec/docs/superpowers/plans/2026-10-30-fantaspec.md` (Task 4 checkboxes)

## Self-review findings (fixed before commit)

- `names.py` had an unneeded `Callable` annotation on the loop variable, which I dropped. I also made the
  surname helper private (`_surname`). `normalise` stays public because it may be useful to later tasks.
- I added the reject-markup tests so that a page redesign raises instead of yielding empty lists.

## Concerns / notes for later tasks

- The page data is inconsistent in one place: the lineups page lists N'Dicka (roma) on the bench at 60%,
  while his ballot shows "Balerdi 60% / N'Dicka 40%". As the brief says, `start_pct` comes from the
  starters and bench `NN%`, not from the ballot percentages.
- If `.team-name` is missing from an unavailable club card, the parser raises `AttributeError` rather than
  `ValueError`. It still fails loudly; the orchestrator should catch any exception per source, not only
  `ValueError`.
- The pipeline imports nothing from `fantaspec.names` yet. Task 6/7 (build) are expected to call
  `match_player` for the unavailable entries.

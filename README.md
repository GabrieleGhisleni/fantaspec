# fantaspec

Personal fantacalcio helper (Classic, standard bonuses). For each saved squad it shows every
player's votes, availability and the stats of their club and next opponent. Phone-first React
site on GitHub Pages; a scheduled Python GitHub Action scrapes fantacalcio.it and ESPN and
commits pre-computed JSON.

- Design: `docs/superpowers/specs/2026-10-30-fantaspec-design.md`
- Plan: `docs/superpowers/plans/2026-10-30-fantaspec.md`

Tests: `cd pipeline && python -m pytest` and `cd web && npx vitest run`.

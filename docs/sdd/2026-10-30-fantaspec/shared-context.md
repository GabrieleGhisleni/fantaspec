# Shared context for every task (extracted from the plan)

**Goal:** A phone-first React site on GitHub Pages that shows, for each saved fantacalcio squad, every player's votes, availability and the stats of their club and next opponent, fed by a Python GitHub Action that scrapes and pre-computes JSON.

**Architecture:** A Python package (`pipeline/fantaspec`) fetches fantacalcio.it HTML and ESPN JSON, caches the parsed raw data in `raw/`, computes everything into three JSON files in `web/public/data/`, and commits only when something changed. An hourly workflow runs a gate that decides from the fixture dates whether this hour is an update slot. The React app (`web/`) reads the three JSON files, keeps squads in localStorage, and is redeployed to Pages whenever code or data changes.

**Tech Stack:** Python 3.14, requests, beautifulsoup4 (`html.parser`), pytest. Node 26, Vite, React 19, TypeScript, Vitest, @testing-library/react, jsdom. GitHub Actions, GitHub Pages (source: GitHub Actions).

**Spec:** `docs/superpowers/specs/2026-10-30-fantaspec-design.md` (this repo). Read it before starting.
## Global Constraints

- Code repo: `~/projects/fantaspec` (new, its own git repo), public GitHub repo `fantaspec`, Pages URL `https://<user>.github.io/fantaspec/`. Ask the user before running `gh repo create`.
- Project CLAUDE.md lives in claude-sync at `projects/fantaspec/CLAUDE.md`, symlinked by `install.sh`.
- No credentials, tokens or `.env` files in either repo.
- Season `2026-27`; ESPN season parameter `2026`; time zone `Europe/Rome` for every slot and every date shown. GitHub cron is UTC.
- Classic roles only: `P`, `D`, `C`, `A`. Standard bonuses: fantavote is taken as published, never recomputed.
- Votes: the first of the three vote pairs on the fantacalcio.it votes page (Redazione Fantacalcio).
- G (goals) = `Gol segnati` + `Rigori segnati` (the page counts them separately; verified: penalty scorers show Gol segnati 0, Rigori segnati 1).
- UI in Italian. Numbers use Italian formatting (`6,5`) via `Intl.NumberFormat('it-IT')`.
- Phone-first: every screen works at 360px wide with no horizontal scroll and no hover-only interaction.
- One HTTP request per page per run, with a browser-like `User-Agent`, 30 s timeout, 3 attempts with backoff.
- A run that fails validation never overwrites `web/public/data/`; a source that fails keeps its previous `raw/` file.
- Plain JSON (no gzip). Raw cache in `raw/` (not served), site data in `web/public/data/` (served).

## Data contract (shared by pipeline and web)

`web/public/data/meta.json`
```json
{
  "season": "2026-27",
  "updatedAt": "2026-10-31T10:07:12+01:00",
  "lastRun": {"at": "2026-10-31T10:07:12+01:00", "kind": "light", "ok": true, "errors": []},
  "nextMatchday": {"number": 10, "from": "2026-10-31", "to": "2026-11-02"}
}
```
`nextMatchday` is `null` when no unplayed fixture is left. `updatedAt` changes only when site data changed.

`web/public/data/clubs.json` — object keyed by fantacalcio club slug:
```json
{"napoli": {"key": "napoli", "name": "Napoli", "position": 4, "points": 17, "played": 9,
  "form": ["L", "L", "W", "D", "W"], "gf": 14, "ga": 10,
  "home": {"played": 5, "gf": 8, "ga": 3}, "away": {"played": 4, "gf": 6, "ga": 7},
  "next": {"opponent": "juventus", "home": false, "kickoff": "2026-10-31T18:00:00+01:00", "matchday": 10,
           "h2h": ["W", "D", "L", "D", "L"]}}}
```
`form` and `h2h` are oldest → newest, seen from this club's side; `h2h` may be shorter than 5 or empty. `next` is `null` when the club has no unplayed fixture.

`web/public/data/players.json` — object keyed by fantacalcio player id (string):
```json
{"572": {"id": 572, "name": "Meret", "club": "napoli", "role": "P",
  "season": {"pres": 9, "medV": 6.0, "medFV": 6.5, "g": 0, "gs": 10, "a": 0, "cs": 3},
  "last5": {"played": 5, "g": 0, "gs": 6, "a": 0, "fv": [5.0, 6.0, 7.0, 4.0, 6.0]},
  "status": {"kind": "injured", "text": "rientro da metà novembre"},
  "startPct": 95}}
```
- `medV`/`medFV` are `null` when `pres` is 0. `cs` is `null` for roles `C` and `A`. `gs` is filled for every role but only shown for `P`.
- `last5.fv` has one entry per club match in the club's last (up to) 5 completed matches, oldest → newest, `null` where the player had no vote.
- `status.kind` is one of `suspended`, `injured`, `doubtful`, `warned` (that priority when several apply), or `status` is `null`.
- `startPct`: integer 0–100 when the club's next match is on the probable-lineups page (0 if the player isn't listed); `null` otherwise.
- `club` is `null` for a player no longer on the fantacalcio roster (left Serie A).
- Players = every roster player plus every player with a vote this season.

## Italian copy (used across web tasks)

| Where | Text |
|---|---|
| Sort options | `Per ruolo`, `Titolarità`, `FV mediana`, `Sfida` |
| Role chips | `Tutti`, `P`, `D`, `C`, `A` |
| Role group headers | `Portieri`, `Difensori`, `Centrocampisti`, `Attaccanti` |
| Matchup (P, D) / (C, A) | `avv. segna 1,7` / `avv. subisce 0,9` (per game) |
| Status tags | `squalificato`, `infortunato`, `in dubbio`, `diffidato` |
| Header | `Giornata 10 · 31 ott – 2 nov`, `Aggiornato 31 ott 10:07` |
| Failed last run | `Ultimo aggiornamento non riuscito: dati del 30 ott 19:05` |
| Detail stats | `Pres`, `Med V`, `Med FV`, `Gol` (`Gol sub.` for P), `Assist`, `Imbattuto` |
| Detail compare rows | `Classifica`, `Forma`, `Gol fatti a partita`, `Gol subiti a partita`, `In casa` / `In trasferta`, `Precedenti` |
| Departed player | `non più in Serie A` |
| Club with no fixture left | `nessuna partita` |
| Form pills (W/D/L) | `V`, `N`, `P` |
| Match cards section | `Partite della giornata` |
| Editor | `Le mie rose`, `Nuova rosa`, `Rinomina`, `Elimina`, `Cerca giocatore`, `Condividi`, `Link copiato` |
| Import | `Importare «{name}» ({n} giocatori)?`, `Importa`, `Annulla`, `Link non valido` |
| First visit | `Crea la tua prima rosa` |

## Review Focus

1. A squad player who never got a vote (new signing, always benched): `pres` 0, medians shown as `–`, no crash, last-5 trend shows gaps.
2. A squad player who left Serie A or vanished from the roster: row still shows the stored name with `non più in Serie A`, never a blank or crash.
3. A broken share link or corrupted localStorage (bad JSON, storage blocked): the app still renders; bad links show `Link non valido`; corrupted storage starts with no squads.
4. A delayed or doubled hourly trigger and the DST change (25 Oct 2026, 28 Mar 2027): every slot is in Europe/Rome time, runs if the trigger arrives up to 90 minutes late, and a second run of the same slot commits nothing.
5. A postponed match: the club's `next` points at its real next fixture, its votes are picked up when the match is finally played (the votes page of the original matchday), and a club with no fixture left has `next: null`.

---

## File structure

```
~/projects/fantaspec/
  .gitignore                     CLAUDE.md symlink, node_modules, dist, __pycache__, .venv, .pytest_cache
  docs/superpowers/              specs/ (design) and plans/ (this plan)
  README.md                      one paragraph + how to run tests
  raw/                           parsed source cache (committed, not served)
  pipeline/
    pyproject.toml
    fantaspec/
      __init__.py
      __main__.py                CLI: gate | run
      config.py                  constants, URLs, paths
      clubs.json                 20-row club mapping
      clubs.py                   load_clubs()
      http.py                    fetch_text(), fetch_json()
      models.py                  dataclasses shared by sources/stats
      sources/espn.py            parse ESPN teams, schedule, standings
      sources/fc_votes.py        parse votes page
      sources/fc_roster.py       parse quotazioni page
      sources/fc_calendar.py     parse calendar page
      sources/fc_lineups.py      parse probable lineups page
      sources/fc_unavailable.py  parse unavailable page
      names.py                   match a name + club to a roster id
      fixtures.py                join calendar + ESPN into Fixture list
      stats.py                   club and player stats
      schedule.py                update slots and the gate decision
      build.py                   assemble, validate, write-if-changed
      run.py                     orchestration with an injectable fetcher
    tests/
      fixtures/                  saved pages (.html.gz, .json)
      test_*.py
  web/
    package.json, vite.config.ts, tsconfig.json, index.html
    public/data/                 meta.json, clubs.json, players.json (generated, committed)
    src/
      main.tsx, App.tsx, styles.css
      types.ts, data.ts, squads.ts, format.ts
      screens/SquadScreen.tsx, screens/SquadEditor.tsx, screens/ImportScreen.tsx
      components/PlayerRow.tsx, PlayerDetail.tsx, MatchCards.tsx, FormPills.tsx, Sparkline.tsx
      test/sampleData.ts
      *.test.ts(x) next to the code
  .github/workflows/ci.yml, deploy.yml, update.yml
```

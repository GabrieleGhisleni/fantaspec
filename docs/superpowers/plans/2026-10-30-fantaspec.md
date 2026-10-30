# fantaspec Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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

---

### Task 1: Repo and claude-sync wiring

**Files:**
- Create: `/home/ggabry/projects/claude-sync/projects/fantaspec/CLAUDE.md`
- Modify: `/home/ggabry/projects/claude-sync/install.sh:29` (add a line after the `assess` link)
- Create: `~/projects/fantaspec/.gitignore`, `~/projects/fantaspec/README.md`

**Interfaces:**
- Produces: the `~/projects/fantaspec` git repo on branch `main`; `~/projects/fantaspec/CLAUDE.md` symlink.

Done on 2026-10-30 in the planning session. The spec and plan moved into this repo
(`docs/superpowers/`), and the page snapshots for Tasks 2–4 were saved into
`pipeline/tests/fixtures/`.

- [x] **Step 1: Write `projects/fantaspec/CLAUDE.md`** in claude-sync, in Italian.
- [x] **Step 2: Add the symlink line to `install.sh`** after the `assess` link:
  `link "$REPO/projects/fantaspec/CLAUDE.md"  "$HOME/projects/fantaspec/CLAUDE.md"`
- [x] **Step 3: Test the new line twice** with `install.sh`'s own `link()` function. Both runs exit 0 and `readlink ~/projects/fantaspec/CLAUDE.md` prints the claude-sync path. Do **not** run the whole `install.sh` on this machine: it would move the real `~/.agents/.skill-lock.json` to `.bak` (replacing it with a link to a file claude-sync doesn't have) and then fails on the missing `global/skills.txt`.
- [x] **Step 4: `git init -b main` in `~/projects/fantaspec`**, with `.gitignore` (lists the `CLAUDE.md` symlink) and `README.md`.
- [x] **Step 5: Commit both repos** (only once the user says so).
  - claude-sync: `git add projects/fantaspec/CLAUDE.md install.sh && git commit -m "fantaspec: CLAUDE.md and install link"` (leave other people's pending changes out)
  - fantaspec: `git add . && git commit -m "chore: initial repo with design, plan and test fixtures"`

---

### Task 2: Python package, club mapping and ESPN parsing

**Files:**
- Create: `pipeline/pyproject.toml`, `pipeline/fantaspec/{__init__,config,clubs,http,models}.py`, `pipeline/fantaspec/clubs.json`, `pipeline/fantaspec/sources/__init__.py`, `pipeline/fantaspec/sources/espn.py`
- Test: `pipeline/tests/test_espn.py`, `pipeline/tests/test_clubs.py`, fixtures `pipeline/tests/fixtures/espn_teams.json`, `espn_schedule_napoli_2026.json`, `espn_standings.json`

**Interfaces:**
- Produces:
  - `config.py`: `SEASON = "2026-27"`, `ESPN_SEASON = 2026`, `TZ = ZoneInfo("Europe/Rome")`, `H2H_SEASONS = 10`, `REPO_ROOT`, `RAW_DIR = REPO_ROOT / "raw"`, `OUT_DIR = REPO_ROOT / "web/public/data"`, and URL helpers `espn_teams_url()`, `espn_schedule_url(espn_id: int, season: int) -> str` (`.../ita.1/teams/{id}/schedule?season={season}`), `espn_fixtures_url(espn_id: int) -> str` (`...?fixture=true`), `espn_standings_url()`, `fc_votes_url(matchday: int)`, `fc_roster_url()`, `fc_calendar_url(matchday: int)` (`https://www.fantacalcio.it/serie-a/calendario/{matchday}`), `fc_lineups_url()`, `fc_unavailable_url()`.
  - `models.py` (frozen dataclasses): `Club(key: str, name: str, espn_id: int)`; `EspnMatch(espn_id: str, kickoff: datetime, home_espn: int, away_espn: int, home_goals: int | None, away_goals: int | None, completed: bool)`; `StandingRow(espn_id: int, position: int, points: int, played: int)`.
  - `clubs.load_clubs() -> list[Club]`, `clubs.by_espn() -> dict[int, Club]`, `clubs.by_key() -> dict[str, Club]`.
  - `http.fetch_text(url: str) -> str`, `http.fetch_json(url: str) -> dict`.
  - `espn.parse_teams(doc: dict) -> dict[int, str]` (espn id → display name), `espn.parse_schedule(doc: dict) -> list[EspnMatch]`, `espn.parse_standings(doc: dict) -> list[StandingRow]`.

- [x] **Step 1: Save the ESPN fixtures.** Already saved on 2026-10-30: `espn_teams.json`, `espn_schedule_napoli_2026.json`, `espn_standings.json` in `pipeline/tests/fixtures/`.
- [x] **Step 2: Write `clubs.json`**: 20 rows `{"key", "name", "espn_id"}` for keys `atalanta bologna cagliari como fiorentina frosinone genoa inter juventus lazio lecce milan monza napoli parma roma sassuolo torino udinese venezia`, Italian display names, espn ids from the saved teams file (known: milan 103, roma 104, atalanta 105, bologna 107, napoli 114, como 2572, cagliari 2925, monza 4007).
- [x] **Step 3: Write the failing tests**

```python
def test_clubs_mapping_complete():
    clubs = load_clubs()
    assert len(clubs) == 20
    assert len({c.espn_id for c in clubs}) == 20
    assert set(by_espn()) == set(parse_teams(load_fixture("espn_teams.json")))

def test_parse_schedule_napoli():
    ms = parse_schedule(load_fixture("espn_schedule_napoli_2026.json"))
    monza = next(m for m in ms if m.kickoff == datetime(2026, 10, 28, 19, 45, tzinfo=UTC))
    assert (monza.home_espn, monza.away_espn, monza.home_goals, monza.completed) == (4007, 114, 1, True)
    frosinone = next(m for m in ms if m.kickoff.date() == date(2026, 10, 10))
    assert (frosinone.home_espn, frosinone.home_goals, frosinone.away_goals) == (114, 3, 0)

def test_parse_standings():
    rows = parse_standings(load_fixture("espn_standings.json"))
    assert len(rows) == 20
    assert sorted(r.position for r in rows) == list(range(1, 21))
```
`load_fixture(name)` lives in `tests/conftest.py` and reads `.json`, `.html` or `.html.gz` from `tests/fixtures/`.

- [x] **Step 4: Run** `cd pipeline && python -m pytest tests/test_espn.py tests/test_clubs.py -v`. Expected: FAIL (imports missing).
- [x] **Step 5: Implement** `pyproject.toml` (package `fantaspec`, dependencies `requests`, `beautifulsoup4`, optional group `test = ["pytest"]`, package data `clubs.json`), `config.py` (`REPO_ROOT = Path(__file__).resolve().parents[2]`), `models.py`, `clubs.py`, `http.py` and `sources/espn.py`. Goals come from `competitors[].score.value`; `home_goals`/`away_goals` are `None` unless `status.type.completed`. Kickoff is the event `date` parsed as UTC.
- [x] **Step 6: Run the tests again.** Expected: PASS.
- [x] **Step 7: Commit** `git commit -m "pipeline: package skeleton, club mapping, ESPN parsers"`.

---

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
- [x] **Step 2: Write the failing tests**

```python
def test_votes_matchday_8():
    rows = parse_votes(load_fixture("fc_votes_8.html.gz"), 8)
    assert len(rows) == 316
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

- [x] **Step 3: Run** `python -m pytest tests/test_fc_votes.py tests/test_fc_roster.py tests/test_fc_calendar.py -v`. Expected: FAIL.
- [x] **Step 4: Implement the three parsers** with BeautifulSoup (`html.parser`).
  - Votes: one row per `tr` containing `a.player-name` with href `/serie-a/squadre/<club>/<slug>/<id>`; skip rows without that link (coaches). Role from `span.role[data-value]` upper-cased. Vote and fantavote from the first `.pill` (`.player-grade` / `.player-fanta-grade`, `data-value` with comma decimal); a non-numeric value means `None`. Bonus cells `.player-bonus[data-value]` by `title`: `Gol segnati`, `Gol subiti`, `Autoreti`, `Rigori segnati`, `Rigori sbagliati`, `Rigori parati`, `Assist`.
  - Roster: rows carry `data-filter-role-classic="p"` and the same player link; club from the link.
  - Calendar: links `calendario/<md>/<season>/<home>-<away>/<id>` filtered to the requested matchday; split `<home>-<away>` by trying every known club key as the prefix, de-duplicated.
- [x] **Step 5: Run the tests again.** Expected: PASS.
- [x] **Step 6: Commit** `git commit -m "pipeline: fantacalcio votes, roster and calendar parsers"`.

---

### Task 4: Lineups, unavailable players and name matching

**Files:**
- Create: `pipeline/fantaspec/sources/fc_lineups.py`, `fc_unavailable.py`, `pipeline/fantaspec/names.py`; extend `models.py`
- Test: `pipeline/tests/test_fc_lineups.py`, `test_fc_unavailable.py`, `test_names.py`; fixtures `fc_lineups.html.gz`, `fc_unavailable.html.gz`

**Interfaces:**
- Consumes: `RosterPlayer`.
- Produces:
  - `LineupEntry(player_id: int, name: str, club: str, start_pct: int, doubtful: bool)`; `fc_lineups.parse_lineups(html: str) -> tuple[list[LineupEntry], set[tuple[str, str]]]` (entries, and the (home, away) club-key pairs of the matches on the page).
  - `Unavailable(club: str, name: str, kind: str, text: str)` with kind `injured` | `suspended` | `warned`; `fc_unavailable.parse_unavailable(html: str) -> list[Unavailable]`.
  - `names.match_player(name: str, club: str, roster: list[RosterPlayer]) -> int | None`.

- [x] **Step 1: Save both pages.** Already saved on 2026-10-30: `fc_lineups.html.gz`, `fc_unavailable.html.gz` in `pipeline/tests/fixtures/`.
- [x] **Step 2: Write the failing tests.** Besides the assertions below, pick one starter, one ballottaggio player and one injured player visible in the saved pages and assert their exact values.

```python
def test_lineups_structure():
    entries, pairs = parse_lineups(load_fixture("fc_lineups.html.gz"))
    assert len({c for pair in pairs for c in pair}) >= 18
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

- [x] **Step 3: Run the tests.** Expected: FAIL.
- [x] **Step 4: Implement.**
  - Lineups: per match block, starters and bench each carry a name link (player id) and a `NN%`; a player in a "ballottaggio" pair is `doubtful=True`. The page's matches are the (home, away) pairs of every match block.
  - Unavailable: per club section, the `Infortunati`, `Squalificati`, `Diffidati` lists; each entry's first word(s) are the name, the rest is `text`; "Nessuno"/"Nessun calciatore" means an empty list.
  - `match_player`: normalise (lower case, strip accents, unify apostrophes, drop dots), only within the same club; exact normalised match first, then a unique surname match; ambiguous or missing → `None`.
- [x] **Step 5: Run the tests again.** Expected: PASS.
- [x] **Step 6: Commit** `git commit -m "pipeline: lineups, unavailable and name matching"`.

---

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
  - `stats.player_stats(roster: list[RosterPlayer], votes: list[VoteRow], fixtures: list[Fixture], lineups: tuple[list[LineupEntry], set[tuple[str, str]]], unavailable: list[Unavailable], clubs_out: dict[str, dict]) -> dict[str, dict]` → the `players.json` object.
  - `history` is a list of `Fixture` from past seasons (matchday 0) used only for head to head.

- [x] **Step 1: Write the failing tests** with a small hand-built season (4 clubs, 6 fixtures, a few vote rows):

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

- [x] **Step 2: Run** `python -m pytest tests/test_fixtures.py tests/test_stats.py -v`. Expected: FAIL.
- [x] **Step 3: Implement** following the spec's Definitions section and the data contract. Medians with `statistics.median`, rounded to 2 decimals. "Last 5" uses the club's last 5 completed fixtures by kickoff and the player's `VoteRow` for each fixture's matchday (any club, so transfers work). Clean sheet: player had a vote and the club conceded 0 in that fixture (roles P and D only). Positions and points come from `standings`; form, goals and splits from fixtures. Head to head: completed meetings from `history` + this season, last 5 by kickoff.
- [x] **Step 4: Run the tests again.** Expected: PASS.
- [x] **Step 5: Commit** `git commit -m "pipeline: fixtures join and stats"`.

---

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

- [x] **Step 1: Write the failing tests** (round 10 on Sat 31 Oct, Sun 1 Nov, Mon 2 Nov; round 11 starting Sat 7 Nov):

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

- [x] **Step 2: Run** `python -m pytest tests/test_schedule.py -v`. Expected: FAIL.
- [x] **Step 3: Implement** `slots` and `due` with `zoneinfo`; build each slot from a local date and time with `datetime.combine(d, t, tzinfo=TZ)`.
- [x] **Step 4: Run the tests again.** Expected: PASS.
- [x] **Step 5: Commit** `git commit -m "pipeline: update slots and gate"`.

---

### Task 7: Build, validate, write-if-changed, and the run orchestration

**Files:**
- Create: `pipeline/fantaspec/build.py`, `pipeline/fantaspec/run.py`, `pipeline/fantaspec/__main__.py`
- Test: `pipeline/tests/test_build.py`, `pipeline/tests/test_run.py`

**Interfaces:**
- Consumes: every parser, `join_fixtures`, `club_stats`, `player_stats`, `slots`, `due`.
- Produces:
  - `build.validate(clubs: dict, players: dict) -> list[str]` — errors when: clubs ≠ 20; fewer than 400 players; a player's `club` is not null and not a club key; any `role` outside P/D/C/A; any `startPct` outside 0–100.
  - `build.next_matchday(fixtures: list[Fixture], now: datetime) -> dict | None` — the lowest matchday with at least 5 unplayed fixtures (so a lone postponed match doesn't count); `from`/`to` are the local dates of its first and last unplayed kickoff. Goes into `meta.nextMatchday`.
  - `build.write_if_changed(out_dir: Path, files: dict[str, dict]) -> bool` — compares each file with what's on disk ignoring `meta.updatedAt` and `meta.lastRun.at`; writes all files (2-space indented JSON, keys sorted) and sets `updatedAt` only when something differs; returns whether it wrote.
  - `run.Fetcher = Callable[[str], str]`; `run.run(kind: str, fetch: Fetcher, now: datetime, backfill: bool = False) -> RunResult(ok: bool, errors: list[str], wrote: bool)`.
  - CLI: `python -m fantaspec gate` prints `kind=<light|full|skip>` and appends it to `$GITHUB_OUTPUT` when set; `python -m fantaspec run --kind <light|full> [--backfill]` exits 0 unless validation failed (exit 1).

Run behaviour:
- `light`: fetch lineups and unavailable; reuse everything else from `raw/`.
- `full`: also ESPN schedules for the 20 clubs (current season), standings, roster, calendar pages for matchdays missing from `raw/calendar.json`, and the votes pages of every matchday that has a fixture completed in the last 4 days.
- `--backfill`: all 38 calendar pages, every completed matchday's votes, and ESPN schedules for the previous `H2H_SEASONS` seasons into `raw/history.json` (fetched only on backfill).
- Each source is parsed right after fetching; a fetch or parse error adds `"<source>: <message>"` to `errors` and leaves that `raw/` file untouched. Parsed results are written to `raw/<source>.json` only when changed.
- Then compute, validate, and `write_if_changed` meta, clubs and players into `OUT_DIR`. `lastRun.ok` is `false` when `errors` is not empty.
- Gate: load fixtures from `raw/`, `due(now, slots(...))`; empty `raw/` → `full`.

- [x] **Step 1: Write the failing tests**

```python
def test_write_if_changed_ignores_timestamps(tmp_path):
    files = sample_outputs()
    assert write_if_changed(tmp_path, files) is True
    again = sample_outputs(updated_at="2026-11-01T10:00:00+01:00", run_at="2026-11-01T10:00:00+01:00")
    assert write_if_changed(tmp_path, again) is False

def test_validate_rejects_empty_scrape():
    assert validate({}, {}) != []

def test_next_matchday_ignores_lone_postponed_match():
    fx = matchday(3, unplayed=1) + matchday(10, unplayed=10, first=date(2026, 10, 31), last=date(2026, 11, 2))
    assert next_matchday(fx, NOW) == {"number": 10, "from": "2026-10-31", "to": "2026-11-02"}

def test_postponed_match_votes_are_fetched(tmp_repo):
    seed_raw(tmp_repo, completed_yesterday=[("lazio", "roma", 3)])   # matchday 3 match played yesterday
    fetch = fake_fetcher()
    run("full", fetch, now=NOW)
    assert fc_votes_url(3) in fetch.requested

def test_failed_source_keeps_old_raw_and_reports(tmp_repo):
    seed_raw(tmp_repo)                                # previous good raw files
    fetch = fake_fetcher(fail={fc_lineups_url()})     # every other URL served from tests/fixtures
    result = run("light", fetch, now=NOW)
    assert result.errors and result.errors[0].startswith("lineups:")
    assert read_raw(tmp_repo, "lineups") == SEEDED_LINEUPS
    assert read_out(tmp_repo, "meta")["lastRun"]["ok"] is False

def test_layout_change_never_overwrites_site_data(tmp_repo):
    seed_raw(tmp_repo); seed_out(tmp_repo)
    fetch = fake_fetcher(override={fc_roster_url(): "<html></html>"})
    result = run("full", fetch, now=NOW)
    assert result.ok is False and result.wrote is False
    assert read_out(tmp_repo, "players") == SEEDED_PLAYERS

def test_same_slot_twice_writes_once(tmp_repo):
    seed_raw(tmp_repo)
    assert run("full", fake_fetcher(), now=NOW).wrote is True
    assert run("full", fake_fetcher(), now=NOW + timedelta(hours=1)).wrote is False
```
`tmp_repo` is a fixture that points `RAW_DIR` and `OUT_DIR` at `tmp_path` (monkeypatch `config`).

- [x] **Step 2: Run** `python -m pytest tests/test_build.py tests/test_run.py -v`. Expected: FAIL.
- [x] **Step 3: Implement** `build.py`, `run.py`, `__main__.py` (argparse). `run` takes the fetcher as a parameter; the CLI passes `http.fetch_text`.
- [x] **Step 4: Run the whole suite** `python -m pytest -v`. Expected: all PASS.
- [x] **Step 5: Real backfill.** From the repo root: `cd pipeline && pip install -e . && python -m fantaspec run --kind full --backfill`. Expected: exit 0, `raw/` filled, `web/public/data/{meta,clubs,players}.json` written; `jq '.["572"].season' ../web/public/data/players.json` shows Meret with `pres` > 0.
- [x] **Step 6: Commit** `git add pipeline raw web/public/data && git commit -m "pipeline: build, validation, run orchestration, first backfill"`.

---

### Task 8: Web app skeleton, data loading and squad storage

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/styles.css`, `web/src/types.ts`, `web/src/data.ts`, `web/src/squads.ts`, `web/src/format.ts`, `web/src/test/sampleData.ts`
- Test: `web/src/squads.test.ts`, `web/src/format.test.ts`, `web/src/App.test.tsx`

**Interfaces:**
- Produces:
  - `types.ts`: `Meta`, `ClubData`, `PlayerData`, `AppData = { meta: Meta; clubs: Record<string, ClubData>; players: Record<string, PlayerData> }` exactly mirroring the data contract.
  - `data.ts`: `loadData(): Promise<AppData>` fetching `${import.meta.env.BASE_URL}data/{meta,clubs,players}.json` with `cache: "no-cache"`.
  - `squads.ts`: `type SquadPlayer = { id: number; name: string }`, `type Squad = { id: string; name: string; players: SquadPlayer[] }`; `loadSquads(): Squad[]`, `saveSquads(s: Squad[]): void` (key `fantaspec.squads.v1`), `loadSelected(): string | null`, `saveSelected(id: string): void` (key `fantaspec.selected`), `encodeShare(s: Squad): string`, `decodeShare(param: string): Squad | null`.
  - `format.ts`: `num1(n: number | null): string` (`6,5`, `–` for null), `perGame(total: number, played: number): number`, `tertile(value: number, all: number[], higherIsGood: boolean): "good" | "bad" | ""`, `startClass(pct: number | null): "good" | "bad" | ""` (≥75 good, <50 bad), `dateRange(from: string, to: string): string` (`31 ott – 2 nov`).
  - `App.tsx`: hash routes `#/` → `SquadScreen`, `#/rose` → `SquadEditor`, `#/importa?s=…` → `ImportScreen` (placeholders in this task, filled by Tasks 9–10). No squads → redirect to `#/rose`.

- [x] **Step 1: Scaffold** with `npm create vite@latest web -- --template react-ts`, add `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`. In `vite.config.ts` set `base: "/fantaspec/"` and `test: { environment: "jsdom" }`. `index.html`: `lang="it"`, viewport meta, title `fantaspec`.
- [x] **Step 2: Write the failing tests**

```ts
test("share link round trip keeps names and order", () => {
  const s = { id: "x", name: "FC Ghisleni", players: [{ id: 572, name: "Meret" }, { id: 184, name: "Bernardeschi" }] };
  expect(decodeShare(encodeShare(s))).toEqual({ ...s, id: expect.any(String) });
});
test("bad share links return null", () => {
  for (const bad of ["", "%%%", btoa("not json"), btoa(JSON.stringify({ n: "x" }))]) expect(decodeShare(bad)).toBeNull();
});
test("corrupted or blocked storage gives no squads", () => {
  localStorage.setItem("fantaspec.squads.v1", "{broken");
  expect(loadSquads()).toEqual([]);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(loadSquads()).toEqual([]);
});
test("italian number format", () => {
  expect(num1(6.5)).toBe("6,5"); expect(num1(null)).toBe("–");
});
test("tertile colouring", () => {
  const all = [0.8, 1.0, 1.2, 1.4, 1.6, 2.0];
  expect(tertile(2.0, all, true)).toBe("good"); expect(tertile(0.8, all, true)).toBe("bad"); expect(tertile(2.0, all, false)).toBe("bad");
});
test("no squads sends the user to the editor", async () => {
  renderApp({ data: sampleData, squads: [] });
  expect(await screen.findByText("Crea la tua prima rosa")).toBeInTheDocument();
});
```
`sampleData.ts` holds a small `AppData` (4 clubs, ~10 players covering every role, one injured, one never voted, one with `club: null`).

- [x] **Step 3: Run** `cd web && npx vitest run`. Expected: FAIL.
- [x] **Step 4: Implement** the modules. Share payload: base64url of `JSON.stringify({ n: name, p: [[id, name], ...] })`. Every localStorage access wrapped in try/catch.
- [x] **Step 5: Run the tests again.** Expected: PASS. Also `npm run build` succeeds.
- [x] **Step 6: Commit** `git commit -m "web: skeleton, data loading, squad storage"`.

---

### Task 9: Squad screen

**Files:**
- Create: `web/src/screens/SquadScreen.tsx`, `web/src/components/{PlayerRow,PlayerDetail,MatchCards,FormPills,Sparkline}.tsx`
- Test: `web/src/screens/SquadScreen.test.tsx`

**Interfaces:**
- Consumes: `AppData`, `Squad`, `format.ts` helpers, copy table above.
- Produces: `SquadScreen({ data, squads, selectedId, onSelect }: Props)`.

Layout (spec "Squad screen"): header (squad select, sort select, `Giornata …`, `Aggiornato …`, red banner when `lastRun.ok` is false), collapsed match cards (`<details>`), role chips, rows. Row line 1: role, name, status tag, Start % (`startClass`), chevron. Line 2: `vs`/`@` opponent and its position, `FV {medFV}`, matchup text. Tap toggles the detail (several can be open). Matchup value: opponent `gf/played` for P and D, `ga/played` for C and A, coloured with `tertile` across all 20 clubs. Sorting: `Per ruolo` (P, D, C, A, then name), `Titolarità` (desc, null last), `FV mediana` (desc, null last), `Sfida` (best matchup first: lowest opponent GF/game for P/D, highest opponent GA/game for C/A).

- [ ] **Step 1: Write the failing tests**

```tsx
test("groups by role with Italian headers", () => {
  render(<SquadScreen {...props} />);
  expect(screen.getAllByRole("heading").map(h => h.textContent)).toEqual(["Portieri", "Difensori", "Centrocampisti", "Attaccanti"]);
});
test("D chip + Sfida sort puts the defender facing the weakest attack first", async () => {
  render(<SquadScreen {...props} />);
  await user.click(screen.getByRole("button", { name: "D" }));
  await user.selectOptions(screen.getByLabelText("Ordina"), "Sfida");
  expect(rowNames()).toEqual(["Bastoni", "Dimarco", "Di Lorenzo"]);   // per sampleData
});
test("tapping a row shows the club vs opponent comparison", async () => {
  render(<SquadScreen {...props} />);
  await user.click(screen.getByText("Meret"));
  expect(screen.getByText("Gol subiti a partita")).toBeInTheDocument();
  expect(screen.getByText("Gol sub.")).toBeInTheDocument();
});
test("never-voted and departed players render safely", () => {
  render(<SquadScreen {...props} />);
  expect(within(row("Panchinaro")).getByText("FV –")).toBeInTheDocument();
  expect(within(row("Partito")).getByText("non più in Serie A")).toBeInTheDocument();
});
test("failed last run shows the banner", () => {
  render(<SquadScreen {...props} data={{ ...sampleData, meta: { ...sampleData.meta, lastRun: { ...sampleData.meta.lastRun, ok: false } } }} />);
  expect(screen.getByText(/Ultimo aggiornamento non riuscito/)).toBeInTheDocument();
});
test("club with no next match", () => {
  render(<SquadScreen {...props} />);
  expect(within(row("Senzapartita")).getByText("nessuna partita")).toBeInTheDocument();
});
test("status tags and collapsed match cards", () => {
  render(<SquadScreen {...props} />);
  expect(within(row("Kean")).getByText("infortunato")).toBeInTheDocument();
  expect(screen.getByText(/Partite della giornata/).closest("details")).not.toHaveAttribute("open");
});
```

- [ ] **Step 2: Run** `npx vitest run src/screens/SquadScreen.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the screen and components. `Sparkline` is an inline SVG polyline (60×16) over the `last5.fv` values with gaps for `null`; `FormPills` renders W/D/L as `V`/`N`/`P` squares (Italian). Styles in `styles.css` with CSS variables and a `prefers-color-scheme: dark` block; the page content is a single column with `max-width: 480px` centred, which is the desktop layout too.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Check at 360px.** `npm run dev`, open it in the browser pane, resize to 360×780, load `public/data` from the Task 7 backfill: no horizontal scroll, rows expand, chips and sort work. Screenshot for the user.
- [ ] **Step 6: Commit** `git commit -m "web: squad screen"`.

---

### Task 10: Squad editor and import

**Files:**
- Create: `web/src/screens/SquadEditor.tsx`, `web/src/screens/ImportScreen.tsx`
- Test: `web/src/screens/SquadEditor.test.tsx`, `web/src/screens/ImportScreen.test.tsx`

**Interfaces:**
- Consumes: `squads.ts`, `AppData.players`.
- Produces: `SquadEditor({ data, squads, onChange }: Props)`, `ImportScreen({ param, squads, onImport }: Props)`.

Behaviour: list squads (`Nuova rosa`, `Rinomina`, `Elimina` with a confirm), open one to edit; search over all players by name (accent-insensitive, ≥2 characters), chips to filter by role and a club select; tap a result to add, tap a squad player to remove; no size rules. `Condividi` uses `navigator.share` when available, else copies `location.origin + location.pathname + "#/importa?s=" + encodeShare(squad)` and shows `Link copiato`. Import asks `Importare «{name}» ({n} giocatori)?`; `Importa` adds it (new id; same-name squads get a ` (2)` suffix) and goes to `#/`; an invalid param shows `Link non valido`.

- [ ] **Step 1: Write the failing tests**

```tsx
test("create a squad, add and remove players", async () => {
  render(<SquadEditor data={sampleData} squads={[]} onChange={onChange} />);
  await user.click(screen.getByText("Nuova rosa"));
  await user.type(screen.getByLabelText("Cerca giocatore"), "mer");
  await user.click(screen.getByText("Meret"));
  expect(lastSaved().players).toEqual([{ id: 572, name: "Meret" }]);
  await user.click(within(squadList()).getByText("Meret"));
  expect(lastSaved().players).toEqual([]);
});
test("search ignores accents and apostrophes", async () => {
  render(<SquadEditor data={sampleData} squads={[sampleSquad]} onChange={onChange} />);
  await user.click(screen.getByText(sampleSquad.name));
  await user.type(screen.getByLabelText("Cerca giocatore"), "ndicka");
  expect(screen.getByText("N'Dicka")).toBeInTheDocument();
});
test("import a valid link", async () => {
  render(<ImportScreen param={encodeShare(sampleSquad)} squads={[]} onImport={onImport} />);
  await user.click(screen.getByText("Importa"));
  expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ name: sampleSquad.name, players: sampleSquad.players }));
});
test("invalid link", () => {
  render(<ImportScreen param="garbage" squads={[]} onImport={onImport} />);
  expect(screen.getByText("Link non valido")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run** `npx vitest run src/screens`. Expected: FAIL.
- [ ] **Step 3: Implement** both screens and wire them into `App.tsx`.
- [ ] **Step 4: Run the full suite** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Check at 360px** in the browser pane: create a squad, add 5 players, share, open the link in a new tab, import.
- [ ] **Step 6: Commit** `git commit -m "web: squad editor and import"`.

---

### Task 11: Workflows, GitHub repo and Pages

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/update.yml`

**Interfaces:**
- Consumes: `python -m fantaspec gate|run`, `npm run build`.

Workflows:
- `ci.yml`: on push and pull_request; job 1 Python 3.14 `pip install -e pipeline[test]` + `python -m pytest pipeline`; job 2 Node 26 `npm ci && npx vitest run && npm run build` in `web/`.
- `deploy.yml`: `on: push (branches: main, paths: web/**)`, `workflow_dispatch` and `workflow_call`. Checks out with `ref: main` (when called from `update.yml`, the event SHA is the commit *before* the data commit), builds `web/` and deploys with `actions/upload-pages-artifact` + `actions/deploy-pages`. Permissions `pages: write`, `id-token: write`, `contents: read`. Concurrency group `pages`.
- `update.yml`: `schedule: cron "7 * * * *"` and `workflow_dispatch` with inputs `kind` (choice light/full, default full) and `backfill` (boolean). Concurrency group `update`, no cancel. Job `gate` (scheduled runs only) outputs `kind`; job `run` (if `kind != skip`) runs `python -m fantaspec run`, then commits `raw/` and `web/public/data/` as `github-actions[bot]` with message `data: <kind> <ISO time>` only if `git diff --cached --quiet` fails, and sets output `changed`. Job `deploy` calls `./.github/workflows/deploy.yml` when `changed == 'true'` (pushes made with `GITHUB_TOKEN` don't trigger other workflows, so the update workflow deploys itself). Permissions `contents: write`, plus those deploy needs.

- [ ] **Step 1: Write the three workflow files.**
- [ ] **Step 2: Lint** with `actionlint` if available (`go run github.com/rhysd/actionlint/cmd/actionlint@latest` otherwise). Expected: no errors.
- [ ] **Step 3: Ask the user** before creating the public repo. On yes: `gh repo create fantaspec --public --source ~/projects/fantaspec --push`, then enable Pages with GitHub Actions as the source (`gh api -X POST repos/{owner}/fantaspec/pages -f build_type=workflow`).
- [ ] **Step 4: Verify CI and deploy.** `gh run watch` on the CI and deploy runs. Expected: both green; `curl -s -o /dev/null -w "%{http_code}" https://<user>.github.io/fantaspec/data/meta.json` prints `200`.
- [ ] **Step 5: Verify the update workflow** with `gh workflow run update.yml -f kind=light`. Expected: green; either a `data:` commit plus a deploy, or no commit when nothing changed.
- [ ] **Step 6: Phone check.** Open the Pages URL in the browser pane at 375×812: create a squad, see rows and details with real data. Send the user the URL.
- [ ] **Step 7: Commit and push** `git commit -m "ci: tests, Pages deploy, scheduled data update" && git push`.

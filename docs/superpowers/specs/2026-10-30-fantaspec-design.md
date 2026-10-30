# fantaspec — design

Date: 2026-10-30
Status: draft, waiting for approval

## Intent

A personal fantacalcio helper. Before each Serie A round the user opens a website on their
phone, picks one of their saved squads (theirs, or a friend's from the same league), and sees
for every player everything needed to decide who to field: the player's votes and numbers,
whether they're available and likely to start, and how their club and the next opponent are
doing. The typical decision is "which defenders do I play this week", so comparing players of
the same role side by side matters most.

## Goals

- One screen per squad with every player and, for each one, the player's own stats plus the
  stats of their club and their next opponent.
- Works well on a phone. The phone is the primary device.
- Hosted for free on GitHub Pages, front-end only (React). No server, no database, no login.
- Data refreshed automatically by a scheduled GitHub Action written in Python, which fetches,
  cleans and pre-computes everything into JSON files committed to the repo.
- Squads created and edited on the site itself.

## Non-goals (v1)

- Live scores or live votes during matches.
- Computing fanta league results, lineups, or any optimiser.
- A desktop-specific layout (desktop gets the phone layout, centred).
- Accounts, sync between devices, notifications.
- Leagues other than Serie A.

## Anti-goals

- The site silently showing wrong or empty data because a scraper broke. A failed or
  suspicious fetch must never overwrite good data, and the site always shows when the data
  was last updated.
- Hammering the source sites: one request per page per run, only in the windows below.
- A phone experience that needs pinching, sideways scrolling or hovering.

## Constraints

- GitHub Pages on a free account, so the repo is public. Everything committed (including
  votes scraped from fantacalcio.it) is publicly readable. The user accepts this for a personal
  project; it is a grey area under fantacalcio.it's terms.
- No credentials, tokens or `.env` files in the repo (claude-sync rule, applies here too).
- Time zone for everything user-facing and for scheduling: Europe/Rome. GitHub cron is UTC.
- UI language: Italian.

## Where it lives

- Code: a new public GitHub repo `fantaspec`, checked out at `~/projects/fantaspec`, served at
  `https://<user>.github.io/fantaspec/`. Ask the user before creating the GitHub repo.
- Claude instructions: `projects/fantaspec/CLAUDE.md` in claude-sync, symlinked into
  `~/projects/fantaspec/CLAUDE.md` through `install.sh`, following the claude-sync convention.
  This design document and the plan live in the fantaspec repo under `docs/superpowers/`.

## Data sources (verified on 2026-10-30)

All fetching happens in the GitHub Action, never in the browser.

| What | Source | Notes |
|------|--------|-------|
| Votes, fantavotes, bonus/malus per player per matchday | `https://www.fantacalcio.it/voti-fantacalcio-serie-a/2026-27/<matchday>` | Server-rendered HTML. Matchday 8 had 316 players across 20 clubs. Per player: role (`span.role[data-value]`, p/d/c/a), link `/serie-a/squadre/<club>/<slug>/<id>`, three vote pairs (`.player-grade` / `.player-fanta-grade`, `data-value` with comma decimals), and `.player-bonus` cells titled Gol segnati, Gol subiti, Autoreti, Rigori segnati, Rigori sbagliati, Rigori parati, Assist, Player of the match. The three vote columns are labelled Redazione Fantacalcio, Voto Statistico, Voto Italia, in that order. |
| Full player list (for the squad editor) | `https://www.fantacalcio.it/quotazioni-fantacalcio` | 586 players with the same `/<club>/<slug>/<id>` links, role and club. |
| Probable lineups and starter % | `https://www.fantacalcio.it/probabili-formazioni-serie-a` | Per match: probable XI and bench with a % chance of starting, ballottaggi, plus suspended, one-yellow-from-ban and injured lists. Player links carry the same ids. Published midweek; empty before that. |
| Injuries, suspensions, one yellow from a ban | `https://www.fantacalcio.it/indisponibili-serie-a` | Per club, free text with the injury and an expected return ("rientro da metà novembre"). No player links here: match by name and club. |
| Fixtures, results, kickoff times | ESPN: `https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/teams/<id>/schedule?season=<YYYY>` (results; `season=2026` is 2026-27) and `...?fixture=true` (upcoming) | JSON, no key. Club ids from `.../ita.1/teams` (20 clubs, e.g. Napoli 114). Past seasons work (2024 returned all 38 Napoli matches), which gives head-to-head. |
| League table | ESPN: `https://site.api.espn.com/apis/v2/sports/soccer/ita.1/standings` | JSON, no key. |

Rejected: openfootball (`football.json`, stopped updating on 2026-09-22); fantacalcio.it's
internal live API (obfuscated, signed requests, breaks easily); ESPN `scoreboard` with a date
range (returned 400).

`robots.txt` on fantacalcio.it blocks `/probabiliformazioniseriea`, not the dashed
`/probabili-formazioni-serie-a` page used here.

Both ESPN and fantacalcio.it are unofficial sources and can change without notice.

Club names differ between sources (`inter` vs `Inter Milan`): keep one hand-written 20-row
mapping file, updated each summer when clubs are promoted or relegated.

## Definitions

- **League format**: Classic, so roles are P, D, C, A. Standard fantacalcio.it bonuses and
  maluses, so the fantavote is taken as published and never recomputed.
- **Votes used**: the Redazione Fantacalcio column (the first of the three).
- **Pres**: matches with a vote this season (s.v. does not count).
- **Md V / Md FV**: median vote and median fantavote over those matches.
- **G**: goals scored this season, including penalties scored. For goalkeepers, goals
  conceded instead, shown as a negative number in red.
- **A**: assists this season.
- **CS (clean sheets)**: goalkeepers and defenders only. A match where the player had a vote
  and their club conceded 0.
- **Last 5**: the club's last 5 played Serie A matches, not the player's last 5 appearances.
  Shows G, A, "x/5 played", and the fantavotes of those matches as a small trend line (gaps
  where the player didn't play).
- **Club and opponent stats**: league position, points, form (last 5 as W/D/L), goals scored
  and conceded for the season (also per game), and the home or away split, whichever applies
  to the next match (the club's home numbers and the opponent's away numbers, or the other way
  round).
- **Matchup number**: goalkeepers and defenders see the opponent's goals scored per game;
  midfielders and forwards see the opponent's goals conceded per game. Green when it helps the
  player, red when it hurts.
- **Next opponent**: the club's next unplayed Serie A match (so mid-round, a club that has
  already played shows its next round's opponent).
- **Head to head**: the last 5 Serie A meetings between the two clubs, from the player's
  club's side, looking back at most 10 seasons. Fewer meetings show what exists; none shows
  "nessun precedente".
- **Start %**: from probable lineups; empty until published.
- **Status tags**: injured (with the expected return text), suspended, one yellow from a ban,
  doubtful (in a ballottaggio on the probable lineups).

## Screens

Phone-first. Italian labels.

### Squad screen (home)

- Top: squad selector, sort selector (by role, Start %, Md FV, matchup), the next matchday
  number and its date range, and "dati aggiornati alle …".
- Role filter chips: Tutti, P, D, C, A.
- One compact row per player, grouped by role when sorted by role:
  - line 1: role, name, status tag, Start % (green/neutral/red), expand chevron.
  - line 2: next opponent ("vs" home / "@" away) with its league position, Md FV, and the
    matchup number.
- Tapping a row expands it in place:
  - season numbers: Pres, Md V, Md FV, G, A, CS;
  - last 5: G, A, x/5 played, fantavote trend with values;
  - side-by-side club vs opponent: position and points, form, goals scored per game, goals
    conceded per game, home/away split, head to head.
- Above the list, a collapsed section with one card per upcoming match involving the squad's
  clubs (same club vs opponent numbers, plus which squad players are involved).

### Squad editor ("La mia rosa")

- List of squads: create, rename, delete.
- Inside a squad: search box over all Serie A players (name, filter by club and role); tap to
  add, tap to remove. No roster-size or role-count rules enforced.
- Squads are saved in the phone's browser (localStorage).
- "Condividi" builds a link with the squad in the URL (player ids). Opening it offers to import
  the squad. This moves squads between devices, shares them with friends, and acts as a backup.
- First visit with no squads: go straight to the editor.

## Update schedule

GitHub can't change a workflow's timetable on its own, so the workflow is triggered hourly and
first runs a quick check against the saved fixture list. Outside the windows below it exits
without fetching or committing. Times are Europe/Rome.

- **2 days before the first match of a round, and the day before**: 2 runs a day (09:00, 19:00).
- **Each match day**: 10:00 (last lineup news) and 23:30 (results and first votes).
- **The day after the round's last match** (final votes, table): 1 run (12:00).
- **The day after that**: 1 run (12:00).
- **Any other day**: no run.
- Overlapping rounds (midweek rounds) simply take the union of their windows. Postponed
  matches follow automatically because windows come from the fixture list.
- A manual "Run workflow" button (`workflow_dispatch`) forces a full run at any time.

Each run fetches only what that window needs. It commits only if the data changed and passed
validation (for example: 20 clubs present, vote pages not empty, player count in a sane range).
On a failed fetch it keeps the previous data and records the error in the metadata file so the
site can show it.

First run of the season backfills every played matchday's votes and the head-to-head history.

## Data files

Plain JSON committed to the repo (GitHub Pages compresses them on the way out). The Action
pre-computes everything, so the site only reads and renders. Keep the raw per-matchday votes
as well as the computed files so a stats change can be recomputed without re-scraping.
There must be a metadata file with last update time, season, current and next matchday, and
the status of the last run.

## Left to the builder

- Front-end tooling (React with Vite or similar; TypeScript or not), routing, styling.
- Python libraries for fetching and parsing.
- Exact JSON file layout and shapes.
- How the site picks up new data: rebuild and redeploy Pages after each data commit, or have
  the site fetch the JSON at runtime. Either is fine as long as new data shows up without
  manual steps.
- Thresholds for green/red colouring (league-relative is fine).
- Matching injury text to players (name plus club) and parsing the return date text.
- Exact share-link encoding.

## Calls made by Claude (not explicitly decided by the user)

- Redazione Fantacalcio votes; median as the main measure.
- "Last 5" means the club's last 5 matches.
- Clean sheets only for goalkeepers and defenders, defined as above.
- Head to head counts Serie A meetings only, last 5.
- Days outside the update windows (international breaks) get no runs; the manual button covers
  them.
- Next opponent is each club's next unplayed match; head to head looks back at most 10 seasons.
- A player who leaves Serie A stays in the squad, marked as no longer in Serie A.
- Plain JSON rather than gzip.
- Match cards start collapsed.

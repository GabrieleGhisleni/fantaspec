# Task 9 report: Squad screen

Status: DONE. Commit `4693ce1 web: squad screen` (not pushed).

## What was implemented

- `web/src/screens/SquadScreen.tsx` replaces the placeholder. Same named export and props.
  - Header: a squad `<select aria-label="Rosa">` that calls `onSelect`, and a sort `<select>` labelled `Ordina` with the options `Per ruolo`, `Titolarità`, `FV mediana` and `Sfida`. Below them: `Giornata 10 · 31 ott – 2 nov` (left out when `nextMatchday` is null), then `Aggiornato 31 ott 10:07`. When `lastRun.ok` is false, a red `role="alert"` banner says `Ultimo aggiornamento non riuscito: dati del …` with the date taken from `updatedAt`.
  - `MatchCards`, then role chips (`Tutti P D C A` as `aria-pressed` buttons, at least 40 px tall), then the rows. `Per ruolo` groups the rows under `<h2>` headings (`Portieri`, `Difensori`, `Centrocampisti`, `Attaccanti`). Rows for players missing from the data go in one last list with no heading. The other sorts show a single flat list with no headings. When nothing matches, the screen shows `Nessun giocatore`.
  - Expanded rows are kept as a set of player ids at screen level. Several rows can be open, and they stay open across sort and filter changes.
  - Each row is wrapped in an `ErrorBoundary`. If one throws, a fallback `<li>` shows the name and `dati non disponibili` (ruling R19).
- `web/src/components/`
  - `PlayerRow.tsx`. Line 1: a coloured role badge, the name (wraps, `min-width: 0`), the status tag (`squalificato` / `infortunato` / `in dubbio` / `diffidato`), Start % coloured with `startClass` (hidden when null), and a chevron. Line 2: `vs`/`@` + opponent + position (`@ Juventus 2°`), or `nessuna partita`, or `non più in Serie A`. Then `FV {num1(medFV)}` (`FV –` when never voted), then the matchup text coloured with `tertile`. The row is a `<button aria-expanded>`. A player whose id is missing from players.json gets a static row with the stored name and `non più in Serie A`.
  - `PlayerDetail.tsx`. The status text when there is one (`rientro da metà novembre`). A table labelled Stagione | Ultime 5 with Pres (last 5 shown as `x/n`), Med V, Med FV, Gol (`Gol sub.` for P, shown as a red negative number such as `−10`), Assist, and Imbattuto (P and D only). A trend line labelled "FV ultime 5" with the `Sparkline` and the values (`5,0 6,0 …`, `–` for gaps). Then `ClubCompare` when the club has an opponent.
  - `ClubCompare.tsx` (an extra file, used by both PlayerDetail and MatchCards). Club vs opponent table with `Classifica` (`4° · 17 pt`), `Forma` (pills), `Gol fatti a partita`, `Gol subiti a partita` (per game, via `perGame`), and the venue row. That row reads `In casa / In trasferta` and shows the club's home split against the opponent's away split, or the reverse. Its values look like `6–7 in 4`. `Precedenti` shows pills for each side (the opponent's side mirrored), or `nessun precedente`. An optional `In rosa` row is used by the match cards.
  - `MatchCards.tsx`. A `<details>` that starts collapsed, with the summary `Partite della giornata (n)`. It holds one `<article>` per distinct upcoming match of the squad's clubs, soonest first: `Juventus – Napoli`, the kickoff (`sab 31 ott 18:00`, Rome time), the comparison from the home side, and the squad players on each side. The cards are only rendered once the section is opened (`onToggle`). This keeps names and labels from showing up twice in the DOM while it is closed.
  - `FormPills.tsx`: W/D/L shown as `V`/`N`/`P` squares, green/neutral/red.
  - `Sparkline.tsx`: a 60×16 SVG with one polyline per run of consecutive votes, a dot for a lone vote and gaps for `null`, `aria-hidden`.
  - `ErrorBoundary.tsx`: a small class component built on `getDerivedStateFromError`.
- `web/src/screens/squadView.ts` (a shared pure-helper module, as the controller allowed) holds `buildRows`, `matchup`, `sortRows`, `SORTS`, `ROLE_GROUPS`, `mirror` and the `Row` type. Both the screen and the components use them.
  - The matchup value is the opponent's `gf/played` for P and D (lower is good) and its `ga/played` for C and A (higher is good). Its colour comes from `tertile` across every club in `data.clubs`.
  - Sorting: the base order is role P, D, C, A, then name (`localeCompare` with "it"). `Titolarità`, `FV mediana` and `Sfida` sort high to low with null last, using a stable sort so ties keep the base order.
  - `Sfida` uses a score: the share of all clubs that the opponent is easier than. It follows the same order as the raw value within a role (the brief's rule), and it also lets the `Tutti` list mix roles in a meaningful way.
- `web/src/format.ts`: added `dayTime(iso)` → `31 ott 10:07` and `kickoffTime(iso)` → `sab 31 ott 18:00`. Both use `Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', … })` and `formatToParts`, because the plain format puts a comma in.
- `web/src/styles.css`: new CSS variables (light and dark in the existing `prefers-color-scheme` block) for warning and bad backgrounds, chips, text on the accent colour, and role colours. Added styles for the header, banner, match cards, chips, rows, detail tables (`table-layout: fixed`, wrapping, `tabular-nums`), sparkline and pills. There are no hover rules. Rows are at least 48 px tall and chips at least 40 px. Everything can shrink or wrap (`min-width: 0`, `flex-wrap`, `overflow-wrap: anywhere`), so nothing forces width beyond 360 px.
- Plan: Task 9 steps 1, 2, 3, 4 and 6 are ticked. Step 5 (the 360 px check in the browser) is left for the controller.

## Tests

- `web/src/screens/SquadScreen.test.tsx`: the brief's 7 tests, word for word, plus 16 more:
  - header in Rome time
  - banner with a UTC timestamp → `30 ott 19:05`
  - squad selector calls `onSelect`
  - text on both row lines, including Start % classes
  - green/red matchup orientation
  - role chips filter, with `aria-pressed`
  - `Titolarità` order, with no headings
  - `FV mediana` order
  - `Sfida` across roles
  - several rows open at once, and a second tap collapses
  - the detail numbers (`−10` red, `5/5`, trend values, `4° · 17 pt`, the venue row and its splits)
  - a never-voted player's detail
  - a departed player's detail (no comparison, no `0/0`)
  - a player missing from players.json keeps the stored name
  - a broken player entry shows the boundary fallback while the other rows render
  - opening the match cards (2 cards, players per side, kickoff)
- `ErrorBoundary.test.tsx`, `Sparkline.test.tsx` (3 tests), `FormPills.test.tsx`, and 2 new tests in `format.test.ts`.
- `sampleData.test.ts` is unchanged and passes.

### TDD evidence

RED (`cd web && npx vitest run`, after writing the tests and before any implementation):
```
 FAIL  src/components/ErrorBoundary.test.tsx  Error: Failed to resolve import "./ErrorBoundary" ...
 FAIL  src/components/FormPills.test.tsx      Error: Failed to resolve import "./FormPills" ...
 FAIL  src/components/Sparkline.test.tsx      Error: Failed to resolve import "./Sparkline" ...
 FAIL  src/format.test.ts > date and time are shown in Rome time, whatever the browser's zone
 FAIL  src/format.test.ts > kickoff with the weekday
   × groups by role with Italian headers  (… all 22 SquadScreen tests ×: the placeholder renders only "Rosa completa (9)")
 Test Files  5 failed | 4 passed (9)
      Tests  24 failed | 34 passed (58)
```
I added one test later (departed-player detail). It was checked RED against the earlier code (`× a departed player's detail keeps his season numbers, with no club comparison`, 1 failed | 22 passed) and then GREEN.

GREEN:
```
$ cd web && npx vitest run src/screens/SquadScreen.test.tsx
 Test Files  1 passed (1)
      Tests  23 passed (23)
$ cd web && npx vitest run
 Test Files  9 passed (9)
      Tests  64 passed (64)
```
The output is clean: grepping for `stderr|warning|act(` finds 0 lines. Where an error is expected (the boundary tests), `console.error` is spied and silenced.

### Build

`cd web && npm run build` (`tsc -b && vite build`) passes:
```
dist/assets/index-BDDKsk7o.css    5.66 kB │ gzip:  1.83 kB
dist/assets/index-Bua1stwe.js   233.97 kB │ gzip: 73.56 kB
✓ built in 84ms
```

### Smoke check against the real data (temporary, not committed)

I rendered the screen with `web/public/data/*.json` (616 players, 20 clubs) and a 32-player squad: every 20th player plus one id that doesn't exist. Then I expanded every row and opened the match cards. Result: 9 match cards, 0 fallbacks and 0 `console.error` calls. The header showed `Giornata 10 · 31 ott – 2 nov | Aggiornato 30 ott 11:49`, and the missing id rendered as `Sparito / non più in Serie A`.

## Files changed

- `web/src/screens/SquadScreen.tsx`, `web/src/screens/SquadScreen.test.tsx`, `web/src/screens/squadView.ts` (new)
- `web/src/components/PlayerRow.tsx`, `PlayerDetail.tsx`, `MatchCards.tsx`, `FormPills.tsx`, `Sparkline.tsx`, `ClubCompare.tsx` (new), `ErrorBoundary.tsx` (new), plus `ErrorBoundary.test.tsx`, `Sparkline.test.tsx` and `FormPills.test.tsx`
- `web/src/format.ts`, `web/src/format.test.ts`, `web/src/styles.css`
- `docs/superpowers/plans/2026-10-30-fantaspec.md` (Task 9 checkboxes)

## Self-review

- The brief's layout paragraph and the spec's squad screen are covered: header, banner, collapsed cards, chips, both row lines, a detail with season, last 5 and comparison, head to head with `nessun precedente`, and the injured return text.
- The heading rule holds. The only h1–h6 elements are the four group `<h2>`s. The match cards use `<details>/<summary>/<article>/<p>`, and tables use `th` (columnheader/rowheader roles, not heading).
- Review Focus 1: a never-voted player shows `FV –`, medians `–`, `0/5` and a trend of `– – – – –`, and the sparkline has no points. Review Focus 2: a departed player (`club: null`) or a vanished one (missing id) shows the name and `non più in Serie A`, never a blank or a crash. Review Focus 5: a club with `next: null` shows `nessuna partita` and has no comparison or match card.
- Fixes made during self-review:
  - A departed player's detail showed `0/0`; it now shows `–`, with a test.
  - Removed a guard that could never be needed in `matchup`.
  - Clearer FormPills comment.

## Concerns / notes for review

- Extra files beyond the plan's list: `components/ClubCompare.tsx` (the comparison table, shared by PlayerDetail and MatchCards), `components/ErrorBoundary.tsx` (ruling R19) and `screens/squadView.ts` (shared pure helpers). The components import `Row`/`mirror` from `screens/squadView.ts`.
- Mixing roles under `Sfida` with `Tutti` was not specified. I used a cross-club percentile score (see above), so the order is the same as the brief's rule within a role.
- Small Italian labels not in the copy table:
  - `Stagione`, `Ultime 5`, `FV ultime 5` in the detail
  - `In rosa` in the match cards
  - `Nessun giocatore` for an empty filter or squad
  - `Rosa` (aria-label) and `Ruolo` (group aria-label)
  - `nessun precedente`, which comes from the spec
- The venue split is shown as totals, `gf–ga in played` (e.g. `6–7 in 4`). The rows above it are per game.
- Match cards cover each squad club's next fixture, even when it falls outside `nextMatchday` (for example, a club that already played this round). Each card shows its own kickoff date.
- Step 5 (the manual 360 px check in the browser) has not been done. The layout has only been reasoned through; it has not been seen in a browser.

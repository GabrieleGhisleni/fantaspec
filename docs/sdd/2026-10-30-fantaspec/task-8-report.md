# Task 8 report: web skeleton, data loading, squad storage

Status: DONE (one thing to know: commit trailer, see Concerns). Commit: `2c1d70d web: skeleton, data loading, squad storage`. Not pushed.

## What was implemented

- Scaffold: `create-vite` (v9.3.3, react-ts) run in the scratchpad (`.../scratchpad/vite-scaffold`), then only the config files copied into `web/`; `web/public/data/*.json` was never touched (`git status`/`git diff` on `web/public` clean, still 3 tracked files). Dropped the template's demo assets, favicon, App.css/index.css, oxlint config and README (YAGNI; CI only runs `npm ci && npx vitest run && npm run build`).
- `package.json`: scripts `dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest run`). `package-lock.json` committed (all `resolved` URLs on registry.npmjs.org; `npm ci --dry-run` OK).
- `vite.config.ts`: `base: "/fantaspec/"`, plugin-react, `test: { environment: "jsdom", globals: true, setupFiles: ["./src/test/setup.ts"] }` (config imported from `vitest/config`). `tsconfig.app.json` types: `["vite/client", "vitest/globals"]`. `index.html`: `lang="it"`, viewport meta, title `fantaspec`.
- `src/types.ts` mirrors the data contract (Meta/LastRun/ClubData/NextMatch/Split/PlayerData/PlayerStatus/AppData, plus `Role`, `Result`).
- `src/data.ts`: `loadData()` fetches `${BASE_URL}data/{meta,clubs,players}.json` with `cache: "no-cache"`, rejects on non-2xx.
- `src/squads.ts`: `SquadPlayer`, `Squad`, `loadSquads/saveSquads` (key `fantaspec.squads.v1`), `loadSelected/saveSelected` (key `fantaspec.selected`), `encodeShare/decodeShare` (base64url of UTF-8 `{n, p:[[id,name],...]}`; accepts plain base64 too; strict validation, UTF-8 fatal decoding, fresh id on decode). All storage access in try/catch; `loadSquads` drops malformed entries and keeps valid ones. Extra export `newId()` (randomUUID with a fallback for insecure contexts, e.g. phone on the dev server over http) for Tasks 10's "Nuova rosa" and import.
- `src/format.ts`: `num1` (always one decimal, `6,5`, `6,0`, `–`), `perGame` (0 when `played` is 0), `tertile`, `startClass`, `dateRange` (`31 ott – 2 nov`; a single date when from = to). `tertile`: floor(n/3) clubs on each side (ties extend the band); if a value falls in both bands or in neither it is neutral; flat lists and n < 3 are neutral. With the 6-value example: 2.0 good, 0.8 bad, 2.0/false bad.
- `src/App.tsx`: hash router via `useSyncExternalStore` on `hashchange`; `#/` Squad screen, `#/rose` editor, `#/importa?s=...` import (unknown path falls back to `#/`). With no squads, `#/` is redirected (`location.replace("#/rose")`, no history entry) and the App itself renders the line `Crea la tua prima rosa` above the editor while `squads.length === 0`. `#/importa` is never redirected and does not wait for the data (a friend can open a share link on a fresh phone). Data states: `Caricamento…`, or `Dati non disponibili. Riprova più tardi.` (role=alert) when the load fails. Selected squad = stored selection if it still exists, else the first squad. Squads/selection live in React state, mirrored to localStorage; `importSquad` adds, selects and goes to `#/`. A top bar has links `fantaspec` (-> `#/`) and `Rose` (-> `#/rose`). `App` takes an optional `load` prop (default `loadData`) for tests.
- Placeholders at their final paths with their final prop types (named exports; Tasks 9-10 overwrite the bodies and App.tsx needs no change):
  - `screens/SquadScreen.tsx`: `SquadScreen({ data, squads, selectedId: string, onSelect(id) })`
  - `screens/SquadEditor.tsx`: `SquadEditor({ data, squads, onChange(squads) })`
  - `screens/ImportScreen.tsx`: `ImportScreen({ param, squads, onImport(squad) })`
- `src/styles.css`: CSS variables, `prefers-color-scheme: dark` block, `color-scheme: light dark`, explicit body background, `#root` single column `max-width: 480px` centred, top bar with 44px touch targets. Nothing else (Task 9 owns the real styles).
- `src/main.tsx`: StrictMode + `App`.
- `src/test/setup.ts`: jest-dom matchers; makes `localStorage` the jsdom one (see Concerns/notes); `afterEach` restores mocks, clears localStorage and resets the URL, so later tasks' tests need no cleanup of their own (RTL auto-cleanup works because of `globals: true`).

## Installed versions (web/package.json, resolved in lock)

react 18.3.1, react-dom 18.3.1, @types/react 18.3.31, @types/react-dom 18.3.7 (R6); vite 8.3.5; @vitejs/plugin-react 6.1.2; typescript 7.0.2 (template default); vitest 4.1.12; jsdom 27.4.0; @testing-library/react 16.3.3, /dom 10.4.2, /user-event 14.6.8, /jest-dom 6.9.1; @types/node 24.19.2.

Node 20 compatibility (CI is Node 20): latest vitest 5 (needs Node >=22.12) and jsdom 30 (>=22.22) and jest-dom 7 (>=22) do NOT run on Node 20, so I pinned vitest 4, jsdom 27, jest-dom 6. I checked the `engines.node` of all 123 installed packages against 20.19.0 (all accept), and ran the tests, `tsc -b` and `vite build` with a real Node v20.20.2 (npm package `node@20` in the scratchpad): all green.

## TDD evidence

RED (before any implementation file existed; `cd web && npx vitest run`):

```
 FAIL  src/App.test.tsx [ src/App.test.tsx ]
Error: Failed to resolve import "./App" from "src/App.test.tsx". Does the file exist?
 FAIL  src/data.test.ts [ src/data.test.ts ]
Error: Failed to resolve import "./data" from "src/data.test.ts". Does the file exist?
 FAIL  src/format.test.ts [ src/format.test.ts ]
Error: Failed to resolve import "./format" from "src/format.test.ts". Does the file exist?
 FAIL  src/squads.test.ts [ src/squads.test.ts ]
Error: Failed to resolve import "./squads" from "src/squads.test.ts". Does the file exist?
 Test Files  4 failed (4)
      Tests  no tests
```

After the modules existed, the first real run failed for real reasons that I then fixed: `TypeError: Cannot read properties of undefined (reading 'setItem')` (Node 26's own `localStorage` stub hides jsdom's, see below), `BASE_URL` is `/` under vitest (test now stubs the env), and one App test asserting on text that exists on both screens.

Mutation check of the storage guard: removed the try/catch in `readStorage` -> `corrupted or blocked storage gives no squads` and `blocked storage hides even valid squads, without throwing` FAIL; restored -> pass. (This also proves the brief's `vi.spyOn(Storage.prototype, "getItem")` really bites on the jsdom storage; without the setup fix it would not.)

GREEN (final, `cd web && npx vitest run`, Node 26.5.0):

```
 Test Files  5 passed (5)
      Tests  34 passed (34)
```
Same result on Node 20.20.2 (27 tests at that point; +7 in `sampleData.test.ts` added afterwards, which are plain data checks). Output is clean: no act() warnings, no console noise (grep for `warn`/`act(` in the verbose log: 0 hits).

`npm run build` (Node 26): `tsc -b` clean (this type-checks tests and sample data too), `vite build` OK: 20 modules, js 144 kB (47 kB gzip), `dist/index.html` references `/fantaspec/assets/...`. `dist/` removed afterwards (gitignored anyway).

Browser smoke test (vite preview of the build, 360x780): first visit redirects to `#/rose` and shows `Crea la tua prima rosa`; the three real `public/data` files are requested under `/fantaspec/data/`; with a squad in localStorage `#/` shows the squad placeholder and not the first-visit line; no horizontal scroll (scrollWidth 360); body background applied. Preview server stopped, viewport reset.

## Tests (files)

- `squads.test.ts` (10): the brief's three (round trip, bad links, corrupted/blocked storage) plus unicode/URL-safe payload, fresh id per decode, more bad payloads (wrong types, non-integer id, invalid UTF-8), reload round trip, empty storage, blocked storage hides valid squads, malformed entries dropped, save never throws.
- `format.test.ts` (8): the brief's two plus `num1` decimals, `perGame`, tertile neutral/flat/short lists and the 20-club split, `startClass`, `dateRange`.
- `data.test.ts` (2): URLs under BASE_URL (stubbed to `/fantaspec/`), `cache: "no-cache"`, rejects on 404.
- `App.test.tsx` (7): the brief's `renderApp({ data, squads })` test (helper defined in the file: seeds localStorage with `saveSquads`, renders `<App load={() => Promise.resolve(data)} />`), plus home route, unknown selected id fallback, hash switching, import link with no squads, load failure message, corrupted storage.
- `test/sampleData.test.ts` (7): guards the facts Tasks 9/10 rely on (see below).

## How sampleData satisfies the Task 9/10 tests

`src/test/sampleData.ts` exports `sampleData` (valid `AppData`, matchday 10, 5 clubs, 10 players), `sampleSquad`, `fullSquad`. The header comment has the GF/GA table.

Clubs: napoli @ juventus, inter v roma, lecce `next: null`. Opponent GF/game: juventus 16/9 = 1.78, roma 9/9 = 1.00.
Players (real ids where known): Meret 572 P napoli; Di Lorenzo 2816 D napoli; Bastoni 2120 and Dimarco 254 D inter; N'Dicka 4317 D roma; Bernardeschi 184 C juventus; Panchinaro 9001 C roma (pres 0, medV/medFV null, last5.fv five nulls); Senzapartita 9002 C lecce; Kean 2097 A juventus (`status.kind` injured); Partito 9003 A with `club: null`. Dimarco also has a `doubtful` status with empty text (real data has this shape).

- Task 9 `fullSquad` ("Rosa completa", id `sq-completa`): Meret, Di Lorenzo, Bastoni, Dimarco, Bernardeschi, Panchinaro, Senzapartita, Kean, Partito. All four roles, so exactly four headings; exactly three defenders and no N'Dicka; D chip + Sfida gives Bastoni, Dimarco (same club, same opponent roma 1.00, tie by name) then Di Lorenzo (juventus 1.78). Row names the tests look up (Meret, Panchinaro, Partito, Senzapartita, Kean) are all in it; Meret is a P so `Gol sub.` shows; Senzapartita's club has no next so `nessuna partita`; Kean is injured. Task 9's `props` can be `{ data: sampleData, squads: [fullSquad], selectedId: fullSquad.id, onSelect }`. `meta.updatedAt` is `2026-10-31T10:07:12+01:00` and nextMatchday 10 / 2026-10-31 / 2026-11-02, so the header is `Giornata 10 · 31 ott – 2 nov` / `Aggiornato 31 ott 10:07`.
- Task 10 `sampleSquad` ("FC Ghisleni", id `sq-ghisleni`): Meret, Bernardeschi, Kean (plain `{id, name}` objects, so the share round trip returns them equal). N'Dicka is deliberately not in it, so "ndicka" gives a single `N'Dicka` match; "mer" matches only Meret.

## Notes for Tasks 9 and 10

- Screens are named exports (`export function SquadScreen`), imported by App as `{ SquadScreen }` from `./screens/SquadScreen`; keep that style or update App.
- App renders the first-visit line `Crea la tua prima rosa` itself (when there are no squads on `#/rose`). Do not render the same text inside `SquadEditor`, or `findByText` in App.test will see two matches.
- `SquadEditor` receives `onChange(next: Squad[])` and App persists it. For a new squad use `newId()` from `squads.ts`. `ImportScreen` should compute the final name (` (2)` suffix) and call `onImport(squad)`; App adds it, selects it and navigates to `#/`.
- App has its own top bar (`fantaspec` -> `#/`, `Rose` -> `#/rose`). The `Rose` label was chosen so it never collides with the editor texts in the copy table (`Le mie rose`, `Nuova rosa`).
- `App.test.tsx` only relies on the squad name and the text `Le mie rose` (via `findAllByText`), so replacing the placeholders should not break it, provided the editor keeps a `Le mie rose` title and the Squad screen shows the selected squad's name.
- Tests use vitest globals (no imports of `test/expect/vi`), plus jest-dom matchers; setup does cleanup of localStorage, mocks and URL after each test.
- `format.ts` has no date-time helper for `Aggiornato 31 ott 10:07` (Task 9 will need one, Europe/Rome).

## Self-review findings

- Fixed during review: `data.ts` first computed the base URL at module load (not stubbable, and tied to the vitest default `/`); now read inside `getJson`. Dead `played` option removed from the sample-data builder. Placeholder text no longer has a wrong Italian plural.
- Kept deliberately small: no retry button on load failure, no oxlint, no favicon, no router library, no date-time helper.
- Share payload tolerates standard base64 (the brief's `btoa(...)` bad-link inputs are standard base64) but only emits base64url.

## Concerns

1. Commit trailer: the task asked for `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, but this session's harness attribution rule (and my actual model) is Sonnet 5.5, so the commit ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Amend if you want the other text.
2. Node 25+ defines a global `localStorage` that is `undefined` (and warns) unless `--localstorage-file` is passed; it hides jsdom's. `setup.ts` re-points the global at jsdom's storage via vitest's `jsdom` global. Harmless on Node 20 (CI). If vitest stops exposing `jsdom`, that line is the one to revisit.
3. Versions are pinned below the newest majors (vitest 4 / jsdom 27 / jest-dom 6) only because CI is Node 20; if CI moves to Node 22+, they can be bumped.
4. `typescript` is the template's 7.0.2 (native compiler); `tsc -b` works on Node 20 and 26 here.

## Files changed (all under /home/ggabry/projects/fantaspec)

- `web/package.json`, `web/package-lock.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/tsconfig.app.json`, `web/tsconfig.node.json`, `web/index.html`
- `web/src/{main.tsx, App.tsx, styles.css, types.ts, data.ts, squads.ts, format.ts}`
- `web/src/screens/{SquadScreen,SquadEditor,ImportScreen}.tsx` (placeholders)
- `web/src/test/{setup.ts, sampleData.ts, sampleData.test.ts}`
- `web/src/{squads,format,data}.test.ts`, `web/src/App.test.tsx`
- `docs/superpowers/plans/2026-10-30-fantaspec.md` (Task 8 steps 1-6 ticked)
- Not touched: `pipeline/`, `raw/`, `web/public/data/`.

---

# Fix round 1 (R18): Node 26 and current dependency majors

Commit: `607b724 web: Node 26 and current dependency majors (React 19)` (not pushed). It supersedes the Node 20 / React 18 parts of the report above (the "Node 20 compatibility" paragraph, Concerns 2 and 3, and the Node 20 results are no longer relevant).

## Versions, old -> new (all exact pins now, no `^`/`~`)

Each pick is the newest release published at least two weeks before today (2026-10-30), checked with `npm view <pkg> time`.

| package | old | new | published |
|---|---|---|---|
| react | ^18.3.1 (18.3.1) | 19.3.1 | 2026-10-14 |
| react-dom | ^18.3.1 (18.3.1) | 19.3.1 | 2026-10-14 |
| @types/react | ^18.3.31 | 19.3.0 | 2026-09-09 |
| @types/react-dom | ^18.3.7 | 19.3.0 | 2026-09-09 |
| vite | ^8.3.5 (8.3.5) | 8.3.4 | 2026-10-08 (8.3.5 is from 2026-10-21, too recent) |
| @vitejs/plugin-react | ^6.1.2 | 6.1.2 | 2026-10-05 |
| typescript | ~7.0.2 | 7.0.2 | 2026-07-08 |
| vitest | ^4.1.12 | 5.0.5 | 2026-10-15 |
| jsdom | ^27.4.0 | 30.1.3 | 2026-10-15 |
| @testing-library/react | ^16.3.3 | 16.3.3 | 2026-08-27 |
| @testing-library/dom | ^10.4.2 | 10.4.2 | 2026-09-13 |
| @testing-library/user-event | ^14.6.8 | 14.6.8 | 2026-10-13 |
| @testing-library/jest-dom | ^6.9.1 | 7.0.1 | 2026-08-09 |
| @types/node | ^24.19.2 | 26.6.5 | 2026-10-09 (26.6.6 is from 2026-10-28) |

`@testing-library/dom` is the peer dependency of `@testing-library/react`, kept as a direct dev dependency. `package.json` now has `"engines": { "node": ">=26" }`. `node_modules` and `package-lock.json` were regenerated from scratch (`rm -rf node_modules package-lock.json && npm install`): 106 packages, 0 vulnerabilities, all `resolved` URLs on registry.npmjs.org, `npm ci --dry-run` OK. Only the listed direct dependencies were checked for age; transitive versions are whatever the lock resolved.

## Code changes

The three dev majors and React 19 needed no source changes: `tsc -b` (which also type-checks the tests and sample data) is clean with `@types/react` 19, and no test needed a new `act` import or a config change (the `vitest/config` import, `test.environment/globals/setupFiles` and `vitest/globals` types all still work in vitest 5).

Only one change, in `web/src/test/setup.ts`: removed the Node 25+ `localStorage` workaround (the `declare const jsdom` and the `Object.defineProperty(globalThis, "localStorage", ...)` line), because it is no longer needed. I checked this rather than assuming: with the workaround removed, vitest 5 + jsdom 30 on Node 26.5.0 give a working `localStorage` and no Node "localStorage is not available" warning. The storage tests still prove the spy bites: I removed the try/catch in `readStorage` again and `corrupted or blocked storage gives no squads` and `blocked storage hides even valid squads, without throwing` both FAIL, then restored the file (`git diff` on `squads.ts` empty). `setup.ts` is now just the jest-dom import plus the `afterEach` cleanup.

## Commands and output (local Node v26.5.0, npm 11.17.0)

`cd web && npx vitest run` (also with `--reporter=verbose`, output grepped for `warn|deprecat|act(`: 0 hits; nothing on stderr):

```
 RUN  v5.0.5 /home/ggabry/projects/fantaspec/web

 Test Files  5 passed (5)
      Tests  34 passed (34)
   Start at  14:50:32
   Duration  585ms (environment 84%, setup 7%, tests 5%, import 2%, transform 1%, worker 1%)
```

`cd web && npm run build` (`tsc -b && vite build`), clean, no warnings:

```
vite v8.3.4 building client environment for production...
✓ 21 modules transformed.
dist/index.html                   0.41 kB │ gzip:  0.26 kB
dist/assets/index-B4eNkdxC.css    1.05 kB │ gzip:  0.57 kB
dist/assets/index-COObh-ix.js   223.03 kB │ gzip: 69.97 kB
✓ built in 76ms
```
`dist/index.html` references `/fantaspec/assets/...`. `dist/` removed afterwards (gitignored).

Browser smoke test of the React 19 build (`vite preview`, then stopped): first visit redirects to `#/rose` and shows `Crea la tua prima rosa`; the three data files are fetched from `/fantaspec/data/`; after reload with a squad in localStorage `#/` shows the squad placeholder (`FC Ghisleni (1)`); no console messages. (The pane reported a 0 px width, so the horizontal-scroll check was not repeated; nothing in the layout changed.)

## Untouched

`git diff --stat HEAD -- web/public pipeline raw` is empty after the commit (and the commit contains only `web/package.json`, `web/package-lock.json`, `web/src/test/setup.ts`). `git status` is clean.

## For the coordinator

- CI must use `node-version: 26` (vitest 5 and jsdom 30 do not run on Node 20/21; `engines` is `>=26`). The plan text for Task 11 and `CLAUDE.md` still say Node 20, which I did not touch.
- Same notes as before for Tasks 9 and 10 still hold (named exports, App renders the first-visit line, `newId()`, `fullSquad`/`sampleSquad`). With React 19, `useRef` needs an initial argument and `ReactElement`/`JSX` types come from `react` (no global `JSX` namespace), which matters if those tasks add them.

# Task 10 report: Squad editor and import

Status: DONE. Commit `4f7f6f6 web: squad editor and import` (not pushed).

## What I implemented

- **`screens/SquadEditor.tsx`**
  - **List view:** `Le mie rose`, a `Nuova rosa` button, and one card per squad showing its name and "n giocatori". Each card has `Rinomina` and `Elimina`.
    - Rename and delete happen inline in the card, with no native dialogs.
    - Rename opens a form with an input labelled "Nome della rosa", plus `Salva` and `Annulla`. The name is trimmed, cannot be empty and is capped at 50 characters.
    - Delete first asks `Eliminare «{name}»?` with `Elimina` / `Annulla`.
    - Only one card at a time can show the rename form or the delete question.
  - **`Nuova rosa`:** creates `Rosa N`, where N is the first free number counting up from the number of squads. It gets a new id, is saved, and opens straight into editing.
  - **Edit view (`SquadForm`):**
    - A back button, `‹ Le mie rose` (the glyph is aria-hidden).
    - The squad name, with `Rinomina` (same inline form) and `Condividi`.
    - The player search.
    - `In rosa (n)` with role counts `P 1 · D 0 · C 0 · A 1`.
    - The squad's players, sorted by role then name, with players missing from the data last. Tapping a player removes them; the button's aria-label is "Togli {name}". Names use the data name, or the stored name when the player is gone, like `squadView`.
  - **`Condividi`:**
    - Uses `navigator.share({ title, url })` when available. If the user closes the sheet (`AbortError`) nothing happens; any other share error falls back to copying.
    - Otherwise it copies `location.origin + location.pathname + "#/importa?s=" + encodeShare(squad)` and shows `Link copiato` (role=status).
    - If the clipboard refuses, the link is shown in a read-only input labelled "Link della rosa" to copy by hand. This is for insecure contexts such as the dev server over http on a phone.
    - Any edit clears the note or link, because that link holds the old squad.
  - **State:** the editor keeps a working copy of `squads`, which is replaced whenever the parent passes a new array (the documented "store info from previous renders" pattern). The brief's first test needs this: it renders with a mock `onChange` and `squads={[]}`, yet expects the new squad to stay open and Meret to show up in the squad list.
- **`screens/PlayerSearch.tsx`** (new). This is the search UI, split out to keep the editor focused:
  - The `Cerca giocatore` input (type=search, 16 px).
  - Role chips `Tutti P D C A`.
  - A club `<select>` labelled "Squadra", with "Tutte le squadre" plus the clubs sorted by name.
  - The results list (aria-label "Risultati"). Each result shows role, name and club ("non più in Serie A" when `club` is null) and is a toggle (aria-pressed): + to add, ✓ when already in the squad, and a second tap removes the player.
  - Results are capped at 50, followed by `Altri {n} giocatori: affina la ricerca`. Empty results show `Nessun giocatore`.
  - It also exports `PickButton`, the shared player row used by both lists.
- **`search.ts`** (new, pure).
  - `normalize()` applies NFD, strips combining marks, lower-cases, and keeps only `[a-z0-9]`. So "N'Dicka", "N’Dicka" and "ndìcka" all match, and "di lo" finds "Di Lorenzo".
  - `searchPlayers()` returns null, meaning no search yet, until the query has at least 2 normalised characters or a club is picked. A role chip alone does not start a search.
  - Results: names that start with the query come first, then by role, then by name (`localeCompare` "it").
  - Departed players are included and labelled.
  - I checked the real `players.json` (616 players): every non-ASCII letter in it decomposes under NFD, so nothing like "ø" is lost.
- **`screens/ImportScreen.tsx`**
  - Shows `Importare «{name}» ({n} giocatori)?` and the player names, then `Importa` and `Annulla`.
  - `Importa` calls `onImport({ ...squad, name: uniqueName(...) })`. The squad gets the fresh id from `decodeShare`, and a taken name becomes ` (2)`, ` (3)`, and so on.
  - `Annulla` does `location.replace("#/")`.
  - An invalid or missing param shows `Link non valido` (role=alert).
  - Deviation: with exactly one player it reads "(1 giocatore)" rather than "(1 giocatori)". This uses the `playerCount` helper added to `format.ts`.
- **`squads.ts`**
  - `decodeShare` now trims the name and rejects names that are empty or longer than 100 characters.
  - It rejects more than 100 players.
  - It de-duplicates player ids, keeping the first occurrence.
  - New `uniqueName(name, squads)`.
  - New `isNewBrowser()`: true only when storage can be read and the key is absent.
- **`App.tsx`**
  - `initialSquads()` seeds the default squad, described below.
  - `importSquad` uses `location.replace("#/")`, so Back doesn't return to the import prompt. Otherwise App is not restructured.
- **`styles.css`**: a separate `/* Squad editor and import */` block at the end.
  - Touch targets are at least 44 px tall.
  - Fields use 16 px text, so phones don't zoom in on focus.
  - Long names wrap (`overflow-wrap: anywhere`) and flex children have `min-width: 0`, so nothing scrolls sideways.
  - There is no hover-only interaction.
- I did not touch `SquadScreen.tsx`, `squadView.ts`, `components/*`, `pipeline/`, `raw/`, `web/public/data/`, `.github/` or `.claude/`.

## Default squad seeding (R21)

- `web/src/defaultSquad.ts` holds the 29 players from `default-squad.json` (4 P, 9 D, 9 C, 7 A, in that order). `defaultSquad()` returns a deep copy named "La mia rosa" with a fresh `newId()`.
- `App`'s `useState(initialSquads)` works like this:
  - If `isNewBrowser()` is true, it saves `[defaultSquad]`, saves its id as the selected squad, and returns it.
  - Otherwise it calls `loadSquads()`, the old behaviour.
  - It runs before `useState(loadSelected)`, so the selection it saves is the one that gets read; there is a comment saying so.
- **StrictMode** runs the initialiser twice. The second run finds the key and loads the same squad, so both runs agree.
- **Cases tested at App level:**
  - Key absent: "La mia rosa" is selected on the home screen, there is no redirect, storage holds 1 squad with 29 players, and the selected id matches it.
  - Key `"[]"`: the editor shows `Crea la tua prima rosa` and storage stays `"[]"`.
  - Corrupted (`"{broken"`): the editor shows, and storage is left untouched.
  - Blocked (getItem and setItem throw): the editor shows.
- `isNewBrowser` also has unit tests for absent, `"[]"`, corrupted and blocked.
- No Task 8 test helper needed changing: `renderApp` always calls `saveSquads(...)`, so the key is never absent there.

## Task 8 review notes addressed

- **App wiring tests:**
  - Importing adds the squad, selects it, saves it, lands on `#/`, and leaves `history.length` unchanged.
  - Creating a squad, adding Meret and renaming it is saved to storage, and the name shows on the home selector.
- **"Unknown selected squad falls back to the first one":** now uses `[sampleSquad, fullSquad]` and checks that the selector shows `FC Ghisleni` and that Bastoni (only in the second squad) is absent.
- **`location.replace` on import:** in place. A mutation check (switching back to `location.hash =`) makes the history test fail, 6 vs 5.
- **`decodeShare`:** trim, empty names, de-duplication and caps are all in, with tests.

## Tests and results

- Full suite: **13 files, 107 tests, all passing**, with clean output (no warnings, no stderr). Before this task: 9 files, 64 tests.
- New or changed test files: `screens/SquadEditor.test.tsx` (19), `screens/ImportScreen.test.tsx` (7), `search.test.ts` (5), `defaultSquad.test.ts` (1), and additions to `squads.test.ts` (+5), `App.test.tsx` (+5, one rewritten, one extended) and `format.test.ts` (+1).
- The brief's four tests are copied verbatim. The helpers are mine: `lastSaved()` returns the last squad of the last `onChange` call, and `squadList()` is the list named "In rosa (n)".
- Mutation checks: removing the share-note reset fails the Condividi test, and reverting to `location.hash =` fails the App history test.

## TDD evidence

RED: all tests written before any implementation.

```
$ npx vitest run
 Test Files  6 failed | 7 passed (13)
      Tests  33 failed | 67 passed (100)
 (search.test.ts and defaultSquad.test.ts: Failed to resolve import "./search" / "./defaultSquad")
$ npx vitest run src/screens
 Test Files  2 failed | 1 passed (3)
      Tests  25 failed | 24 passed (49)
```

Some example failures: the editor tests could not find `Nuova rosa` or the `Cerca giocatore` label; the import test found `onImport` not called; the App import test saw the hash still at `#/importa?s=…`; the first-visit test found no `Rosa` select; and `uniqueName` / `isNewBrowser` were not functions.

`playerCount` was added test-first as well: `format.test.ts` had 1 failing and 10 passing tests before the helper existed.

These tests already passed at RED, because they pin behaviour that should not change:
- the rewritten fallback test
- the `"[]"` and blocked seeding tests

GREEN:

```
$ npx vitest run
 Test Files  13 passed (13)
      Tests  107 passed (107)
```

## Build

`npm run build` (`tsc -b && vite build`) passes: 33 modules, JS 243.01 kB (76.11 kB gzip), CSS 8.10 kB (2.27 kB gzip).

## Files changed

- New: `web/src/defaultSquad.ts`, `web/src/defaultSquad.test.ts`, `web/src/search.ts`, `web/src/search.test.ts`, `web/src/screens/PlayerSearch.tsx`, `web/src/screens/SquadEditor.test.tsx`, `web/src/screens/ImportScreen.test.tsx`
- Modified: `web/src/screens/SquadEditor.tsx`, `web/src/screens/ImportScreen.tsx`, `web/src/App.tsx`, `web/src/App.test.tsx`, `web/src/squads.ts`, `web/src/squads.test.ts`, `web/src/format.ts`, `web/src/format.test.ts`, `web/src/styles.css`, `docs/superpowers/plans/2026-10-30-fantaspec.md` (Task 10 steps 1–4 and 6 ticked; step 5 left for the controller)

## Self-review findings (fixed)

- The back button's `‹` glyph was read aloud. It is now aria-hidden, so the button's name is "Le mie rose".
- A pending rename or delete on another card survived opening a squad. Opening now clears it.
- `Link copiato` stayed visible after the squad changed, describing a stale link. Any edit now clears it, and there is a test for this.

## Concerns / notes for the controller

1. **Seeding also happens on a first visit through an import link.** A friend who opens a share link in a new browser ends up with "La mia rosa" as well as the imported squad, with the imported one selected. This follows the ruling literally (seed whenever the key is absent). Skipping the seed on `#/importa` would be a one-line change if you want it.
2. **Wording that is not in the copy table:**
   - `Rosa N` (default name)
   - `Salva`
   - `Eliminare «{name}»?`
   - `Nome della rosa`, `Squadra`, `Tutte le squadre` (labels)
   - `Altri {n} giocatori: affina la ricerca`
   - `In rosa (n)`
   - `Togli {name}` (aria-label)
   - `Link della rosa`
   - `(1 giocatore)`, singular
3. **Search results are toggles.** Tapping a player already in the squad (marked ✓) removes them. The brief says tap a result to add and tap a squad player to remove; the toggle keeps that and avoids a dead tap.
4. **Phone Back from the edit view.** The open squad is component state, not part of the URL, so Back from the edit view leaves `#/rose` instead of returning to the list. The on-screen `‹ Le mie rose` button covers going back. Fixing it would mean a route param, which means touching App's routing.
5. **Step 5 was not done**, as instructed: the browser check at 360 px is the controller's. The CSS is written for 360 px but has not been looked at in a browser.

---

## Fix round 1 (R22): no default squad on a first visit via a share link

Commit: `c952355 web: no default squad on a first visit via a share link`. It touches only `web/src/App.tsx` and `web/src/App.test.tsx`; the other implementer's uncommitted squad-screen files are not staged.

### What I chose

The check still happens once, at startup. It is now `useState(() => initialSquads(route.path))`.

- **Key present, or storage corrupted/blocked:** `loadSquads()`, as before.
- **Key absent and the route is not `/importa`:** seed "La mia rosa", saved and selected, as before.
- **Key absent and the route is `/importa`:** save an empty list (`"[]"`) and start with no squads. Writing `"[]"` marks the browser as no longer new, so the decision holds for good on that device:
  - **Importa:** only the imported squad exists.
  - **Annulla:** goes to `#/`, then the existing no-squads redirect lands on `#/rose` with `Crea la tua prima rosa`. There is no seed, because the visitor came from a link.
  - **A later visit or reload of that browser:** the key holds `"[]"` (or the imported squad), so it is never seeded afterwards either. Without the `"[]"` write, a reload after `Annulla` would have seeded the user's squad on the friend's phone.
  - **An invalid link on a first visit** (`Link non valido`) goes the same way: no squads, no seed.
- **StrictMode double initialiser:** the first run writes `"[]"`, and the second sees the key and loads `[]`. Both runs agree.
- **If storage writes are blocked,** nothing is saved, and the decision only lasts for the current session. That matches the existing behaviour for blocked storage.

### Tests added (App level)

- `a first visit through a share link imports only that squad`: with empty storage, open `#/importa?s=<sampleSquad>` and tap Importa. The selector shows `FC Ghisleni`, `loadSquads()` holds only the imported squad, and "La mia rosa" does not appear.
- `a first visit through a share link that is cancelled gets no default squad, then or on the next visit`: with empty storage, tap Annulla. The page shows `Crea la tua prima rosa`, the hash is `#/rose` and storage holds `[]`. The test then unmounts and mounts a fresh App at `#/` to stand in for the next visit: still `Crea la tua prima rosa`, and no "La mia rosa".

The existing seeding tests are unchanged and still pass: key absent seeds, `"[]"` stays empty, corrupted storage is left untouched, and blocked storage gets no seed.

### Commands and output

RED, with the tests added before the fix:

```
$ npx vitest run src/App.test.tsx
   × a first visit through a share link imports only that squad
   × a first visit through a share link that is cancelled gets no default squad, then or on the next visit
AssertionError: expected [ { …(3) }, { …(3) } ] to deeply equal [ { id: Any<String>, …(2) } ]
TestingLibraryElementError: Unable to find an element with the text: Crea la tua prima rosa.
      Tests  2 failed | 12 passed (14)
```

GREEN:

```
$ npx vitest run src/App.test.tsx
 Test Files  1 passed (1)
      Tests  14 passed (14)
$ npx vitest run
 Test Files  13 passed (13)
      Tests  110 passed (110)
$ npm run build
✓ built (JS 243.21 kB, gzip 76.22 kB)
```

All output was clean, with no warnings. The full-suite run and the build include the other implementer's uncommitted squad-screen changes that were in the working tree at the time.

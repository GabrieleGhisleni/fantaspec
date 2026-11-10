# Task 9 — Squad screen UI review (browser pane, phone widths)

Reviewed on 2026-10-30 against commit `4693ce1 web: squad screen`, Vite dev server, real data in
`web/public/data/` (meta: Giornata 10, updated 30 ott 11:49). Viewports: 360×780 (light + dark),
375×812, desktop (1024 wide, 480 px column). Source code was not changed.

Seeded squads (localStorage of the `localhost:5173` origin, still there):
- `rosa-principale` "La mia rosa": the user's 22 players from `default-squad.json`.
- `rosa-test` "Prova casi limite": Meret (P), Milinkovic-Savic V. (P, long name), Floriani Mussolini (D),
  Ostigard (D, `diffidato`), Ghion (C, in players.json with `club: null`), Nicolussi Caviglia (C, never voted),
  Thorstvedt (C, `squalificato`), Partito (id 999999, not in the data).

**Result: 0 Critical, 2 Important, 12 Minor.** No horizontal scroll anywhere, no crash, no console errors.

---

## Critical

None.

---

## Important

### I1. Match cards break squad player names mid-word ("Bernardesc|hi")
- **Seen:** 360×780 and 375×812, `Partite della giornata` opened, card "Bologna – Monza", row `In rosa`.
  The cell holds "Miranda J., Bernardeschi". "Bernardeschi" is split across two lines as "Bernardesc" / "hi".
  The value columns are 99 px wide at 360 (104 px at 375). The compare table inside a card uses the body
  font, 16 px, while the same table in a row detail uses 14 px (`.detail { font-size: 14px }`). The
  `overflow-wrap: anywhere` on `.compare td` lets a single word break at any letter. This happens with the
  user's own squad, so it shows on the first opening of the section.
- **Why it matters:** the `In rosa` row is the reason the cards exist ("which of my players are in this
  match"), and the user's names come out split mid-word.
- **Fix:** in `styles.css` give `.match-card .compare` the same 14 px as `.detail`, and use
  `overflow-wrap: break-word` (not `anywhere`) on `.compare td`. In `ClubCompare.tsx`, render `players` as one
  name per line (e.g. `<span className="names">` with `display:block` children) rather than `join(", ")`.
  See also M8 for moving this row up.

### I2. Labels in the comparison table wrap to 2–3 lines, and the home/away value reads like a score
- **Seen:** 360×780, row detail (e.g. Delprato) and every match card. The label column is 36% = 113 px.
  `Gol fatti a partita`, `Gol subiti a partita` and `In trasferta / In casa` each take two lines
  (row heights 48 px against 28 px for single-line rows). The venue label breaks as "In trasferta / In" + "casa".
  The venue values are `2–9 in 4` / `11–8 in 5`, which look like match results, not "2 goals scored and
  9 conceded in 4 away games". Delprato's expanded row is 574 px tall at 360, Pessina's 673 px. So one open
  detail is close to a full screen, and two open details can't be compared without scrolling.
- **Why it matters:** this table is the core of "should I play him this week". The venue row is the most
  match-specific number in it, and it is the hardest one to read.
- **Fix:** `ClubCompare.tsx`: shorter labels that fit one line at 360 (`Gol fatti/partita`,
  `Gol subiti/partita`, and the venue row labelled for the actual venue, e.g. `Fuori casa` for the club's
  column vs `In casa` for the opponent's. Or drop the combined label and put `(casa)` / `(trasf.)` in the
  column header). Make `splitText` explicit, e.g. `2 fatti · 9 subiti (4 p.)` or per-game values `0,5 / 2,3`,
  to match the two rows above. `styles.css`: label column `width: 34%` with `white-space: nowrap` on the short
  labels, or a 2-column layout at ≤380 px.

---

## Minor

### M1. Line 2 numbers don't line up between rows; 3 of the 22 real rows wrap at 360
- **Seen:** 360×780. `.line2` is a wrapping flex row (315 px usable). `FV …` and the matchup start wherever
  the opponent text ends (`@ Como 4°` vs `vs Fiorentina 18°`). For Volpato and Bowie (vs Fiorentina 18°) and
  Varela G. (`FV 10,0`), the matchup drops onto a third line (`__wraps()` found 3 rows; Thorstvedt in the
  test squad too). There are no wraps at 375.
- **Why:** choosing between 6 defenders means scanning FV and `avv. segna` down the list. Values that jump
  sideways, and the odd row that is taller, slow that down.
- **Fix:** `styles.css` `.line2`: use `display: grid; grid-template-columns: minmax(0,1fr) auto auto;`
  with the opponent cell `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`, so FV and matchup
  sit in fixed right-hand columns. Or shorten the matchup label to `segna 1,7` / `subisce 0,9` on narrow
  screens (`PlayerRow.tsx`).

### M2. Never-voted player: empty sparkline plus "– – – – –" looks like a dashed chart
- **Seen:** Pessina (pres 0, all `last5.fv` null). The row shows `FV ultime 5`, then a blank 60 px SVG, then
  `– – – – –`, which reads as a dotted line. The same happens partly for Dybala (`7,0 6,0 – – –`) and Meret
  (`– 6,0 5,0 3,5 –`).
- **Why:** this looks like a broken graphic, not a clear "never played".
- **Fix:** `PlayerDetail.tsx`: when every value is null, show `nessuna presenza nelle ultime 5` instead of the
  trend. Otherwise use a visible placeholder per match (e.g. `s.v.` or `·`), styled muted.

### M3. Long injury news dominates the detail
- **Seen:** Pessina's `status.text` takes 6 lines / 118 px at 360 (Dybala's and Yildiz's are similar). It
  sits above the numbers in full body colour.
- **Why:** it pushes the stats and the comparison below the fold. Usually all that's needed is "out until
  mid-November".
- **Fix:** `PlayerDetail.tsx` / `styles.css`: `.status-note` muted, 13 px, clamped to 2 lines
  (`-webkit-line-clamp: 2`) with a tap to expand. Or move it below the comparison.

### M4. Injured or suspended players still show a bright green matchup
- **Seen:** Dybala (`infortunato 0%`) shows a bold green `avv. subisce 2,0`, and Thorstvedt (`squalificato 0%`)
  a bold green `avv. subisce 2,3`. In each case the matchup is the boldest positive signal on the row.
- **Why:** the colours say "good pick" for a player who won't play.
- **Fix:** `PlayerRow.tsx`: when `status.kind` is `injured` or `suspended` (or `startPct === 0`), render the
  matchup neutral (drop `matchup.tone`), or dim the whole of line 2 (`.row.out .line2 { opacity: .6 }`).

### M5. `diffidato` uses the same amber as `in dubbio`
- **Seen:** Ostigard `diffidato 90%` vs Couto `in dubbio 55%`: identical amber pill (`.tag-doubtful, .tag-warned`).
- **Why:** "in dubbio" affects this week's choice; "diffidato" (one booking from a ban) almost never does. The
  same colour gives them the same weight.
- **Fix:** `styles.css`: give `.tag-warned` the neutral chip style (default `.tag`) or an outline-only amber.

### M6. Dark mode: white letters on role badges fall below 4.5:1
- **Seen:** 360×780 dark. `#fff` on `--role-d #3fa66c` = 3.05:1, on `--role-c #4f86e0` = 3.61:1, on
  `--role-a #d9574f` = 3.87:1 (13 px bold text, so the 4.5:1 rule applies). In light mode D is 4.25:1. Every
  other pair checked passes: muted/card 6.6, good/card 7.5, bad/card 5.7, warn tag 7.7, bad tag 4.8, pills ≥5.1.
- **Why:** the letter on the badge is hard to read outdoors at night.
- **Fix:** `styles.css` dark block: darker badge fills (e.g. `--role-d: #2a7d4f`, `--role-c: #3466c0`,
  `--role-a: #b8433c`) or a dark `--on-role` for D.

### M7. Match cards section is about 4 screens long, and the squad's players are at the bottom of each card
- **Seen:** 360×780, 8 cards, each 356–424 px high, 3,099 px for the open section. Each card repeats the two
  club names (title `Bologna – Monza` plus the table header `Bologna | Monza`), then 6 stat rows, then
  `In rosa` last. Opening it pushes the role chips and rows far down, with no way to close it at the bottom.
- **Why:** on a phone the quick question is "which of my players play when". The answer is at the end of a
  tall card.
- **Fix:** `MatchCards.tsx`: put the involved players right under the title (e.g. `Miranda J., Bernardeschi ·
  Pessina, Varela G.`). Then either make the compare table expand on tap per card, or keep it compact
  (Classifica, Forma, gol/partita only). Drop the duplicated header row.

### M8. Head-to-head is shown twice (mirrored)
- **Seen:** every compare table: `Precedenti` shows `P P V N P` for one club and `V V P N V` for the other.
  The second column is always the mirror of the first.
- **Why:** it costs a row of attention and doesn't add information.
- **Fix:** `ClubCompare.tsx`: one `<td colSpan={2}>` with the club's side only, e.g. `P P V N P (dal lato Parma)`,
  or a summary like `1V 1N 3P`.

### M9. Squad select truncates names longer than about 14 characters at 360
- **Seen:** 360×780, `Prova casi limite` shows as `Prova casi limi` (text 126 px, select 147 px wide
  including padding and arrow).
- **Why:** squad names like "Lega amici 2026" get cut off, and with two similar names the user can't tell
  them apart.
- **Fix:** `SquadScreen.tsx` / `styles.css`: put the squad select on its own full-width line, with `Ordina`
  and the sort select below it (or the sort select next to the chips). The `.controls` flex already wraps, so
  `flex-basis: 100%` on `.squad-select` is enough.

### M10. A departed player with no data has no group header
- **Seen:** test squad, `Per ruolo`. `Partito` (`–` badge, `non più in Serie A`) is rendered as its own
  `<ul>` straight after the Centrocampisti list. It looks like a midfielder, and in the main squad it would
  look like a forward.
- **Fix:** `SquadScreen.tsx`: give the ungrouped list a header (`Altri` or `Non più in Serie A`).

### M11. The `P` chip is shown for a squad with no goalkeepers and leads to "Nessun giocatore"
- **Seen:** the user's real squad has no P, and tapping `P` gives an empty list.
- **Fix:** `SquadScreen.tsx`: hide or disable (`aria-disabled`, muted) the chips for roles with 0 players, or
  show counts (`D 6`, `C 9`, `A 7`), which also helps with the "do I have enough defenders" question.

### M12. Line 2 `FV 6,0` doesn't say it's the season median
- **Seen:** every row: `FV 6,0`. The sort option says `FV mediana`, the detail says `Med FV`.
- **Why:** "FV" alone reads as the last match's fantavote.
- **Fix:** `PlayerRow.tsx`: `FV med 6,0` (or `Md FV 6,0`). Optionally use the `--fg` colour for this number:
  in the muted line 2 it is visually weaker than the matchup, though it is just as important.

---

## What works well

- **No horizontal scroll at all**: `scrollWidth == clientWidth` (360/360, 375/375). Checked collapsed, with
  6 rows expanded, with all 22 expanded plus the match cards open, and for the edge-case squad. No element's
  box goes past the viewport.
- **Header:** `Giornata 10 · 31 ott – 2 nov` and `Aggiornato 30 ott 11:49` are correct (Europe/Rome, UTC+1
  after the DST change). Selects and the `Rose` link are 44 px tall, selects at 16 px (no iOS zoom on focus).
- **Chips:** 62×40 px each, full row width, clear pressed state (`aria-pressed`), D/C/A filters correct, and
  the role headers stay correct under a filter.
- **Sorting with real data makes sense:** Titolarità puts the 90% players first and the injured 0% last.
  FV mediana starts with Varela G. 10,0 and ends with Pessina `–`. Sfida + D gives Scalvini and Zappacosta
  (vs Parma 0,6), then Couto (vs Venezia 0,7), then the three facing 1,8. Ties keep the role and name order.
- **Edge cases render safely:** never-voted Nicolussi Caviglia / Pessina show `FV –` and `Med V –`.
  `Partito` (unknown id) shows `non più in Serie A`, with no chevron and no crash. Ghion (`club: null` in the
  data) shows `non più in Serie A FV 6,0` and expands without a compare table. The goalkeeper shows
  `Gol sub. −9 / −4` in red and `Imbattuto`. `Imbattuto` is correctly hidden for C/A.
- **Long names** (Milinkovic-Savic V., Floriani Mussolini, Nicolussi Caviglia, De Ketelaere, Varela G., also
  simulated with a status tag and `100%`) wrap at spaces/hyphens and never overlap the tag, percentage or
  chevron.
- **Colour logic is right:** Start % green ≥75, red <50. Matchup tertiles match the data (Parma/Venezia
  attacks green for defenders; Juventus/Milan/Como/Napoli defences red for C/A). Green and red are also bold,
  so the meaning doesn't rely on hue alone.
- **Dark mode** is well done: all text, pill and tag pairs pass contrast except the role badges (M6).
- **Several rows can be open at once**; the chevron flips; rows are real `<button>`s with `aria-expanded`.
- **Desktop:** one centred 480 px column, as intended.
- **Console:** only Vite/React DevTools info messages, no warnings or errors. The Vite log is clean.

## Notes for whoever picks this up

- The match cards section is the only part where the font size differs from the row detail (16 px vs 14 px).
  Fixing that alone shrinks I1 and part of M7.
- The chevron's 180° rotation makes `.line1` 2–4 px wider than its box while expanded. It isn't clipped and
  doesn't affect page scroll; mentioned only so nobody chases it.
- `.claude/launch.json` (config `web`) was created for the review and left untracked.

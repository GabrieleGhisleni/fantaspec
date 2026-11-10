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


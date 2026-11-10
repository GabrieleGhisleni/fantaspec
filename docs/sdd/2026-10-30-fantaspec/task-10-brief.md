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


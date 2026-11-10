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

- [ ] **Step 1: Scaffold** with `npm create vite@latest web -- --template react-ts`, add `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`. In `vite.config.ts` set `base: "/fantaspec/"` and `test: { environment: "jsdom" }`. `index.html`: `lang="it"`, viewport meta, title `fantaspec`.
- [ ] **Step 2: Write the failing tests**

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

- [ ] **Step 3: Run** `cd web && npx vitest run`. Expected: FAIL.
- [ ] **Step 4: Implement** the modules. Share payload: base64url of `JSON.stringify({ n: name, p: [[id, name], ...] })`. Every localStorage access wrapped in try/catch.
- [ ] **Step 5: Run the tests again.** Expected: PASS. Also `npm run build` succeeds.
- [ ] **Step 6: Commit** `git commit -m "web: skeleton, data loading, squad storage"`.

---


import { decodeShare, encodeShare, isNewBrowser, loadSelected, loadSquads, saveSelected, saveSquads, uniqueName } from "./squads";

/** A share param built by hand (ASCII only). */
const b64 = (v: unknown) => btoa(JSON.stringify(v));

test("share link round trip keeps names and order", () => {
  const s = { id: "x", name: "FC Ghisleni", players: [{ id: 572, name: "Meret" }, { id: 184, name: "Bernardeschi" }] };
  expect(decodeShare(encodeShare(s))).toEqual({ ...s, id: expect.any(String) });
});

test("share link keeps accents, apostrophes and emoji, and is URL safe", () => {
  const s = { id: "x", name: "Rosa d'Ōro ⚽", players: [{ id: 4317, name: "N'Dicka" }, { id: 1, name: "Milinković-Savić" }] };
  const param = encodeShare(s);
  expect(param).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(decodeShare(param)).toEqual({ ...s, id: expect.any(String) });
});

test("every decoded share link gets a fresh id", () => {
  const s = { id: "x", name: "A", players: [] };
  expect(decodeShare(encodeShare(s))!.id).not.toBe(decodeShare(encodeShare(s))!.id);
});

test("bad share links return null", () => {
  const bad = [
    "",
    "%%%",
    btoa("not json"),
    b64({ n: "x" }),
    b64({ n: 3, p: [] }),
    b64({ n: "x", p: [[1]] }),
    b64({ n: "x", p: [["1", "Meret"]] }),
    b64({ n: "x", p: [[1.5, "Meret"]] }),
    b64({ n: "x", p: "Meret" }),
    b64(null),
    b64([]),
    "/w", // not valid UTF-8 once decoded
  ];
  for (const param of bad) expect(decodeShare(param)).toBeNull();
});

test("share links: the name is trimmed and must not be empty or absurdly long", () => {
  expect(decodeShare(b64({ n: "  FC Ghisleni ", p: [] }))).toEqual({ id: expect.any(String), name: "FC Ghisleni", players: [] });
  expect(decodeShare(b64({ n: "x".repeat(100), p: [] }))).not.toBeNull();
  for (const n of ["", "   ", "x".repeat(101)]) expect(decodeShare(b64({ n, p: [] }))).toBeNull();
});

test("share links: a repeated player is kept once, where he first appears", () => {
  const squad = decodeShare(b64({ n: "A", p: [[1, "Meret"], [2, "Kean"], [1, "Altro"]] }));
  expect(squad!.players).toEqual([{ id: 1, name: "Meret" }, { id: 2, name: "Kean" }]);
});

test("share links: more than 100 players is not a squad", () => {
  const players = (n: number) => Array.from({ length: n }, (_, i) => [i + 1, `G${i + 1}`]);
  expect(decodeShare(b64({ n: "A", p: players(100) }))!.players).toHaveLength(100);
  expect(decodeShare(b64({ n: "A", p: players(101) }))).toBeNull();
});

test("uniqueName adds the first free number to a taken name", () => {
  const squads = (...names: string[]) => names.map(name => ({ id: name, name, players: [] }));
  expect(uniqueName("A", [])).toBe("A");
  expect(uniqueName("A", squads("B", "A (2)"))).toBe("A");
  expect(uniqueName("A", squads("A"))).toBe("A (2)");
  expect(uniqueName("A", squads("A", "A (2)", "A (4)"))).toBe("A (3)");
});

test("a new browser is one that never saved squads and can read its storage", () => {
  expect(isNewBrowser()).toBe(true);
  saveSquads([]);
  expect(isNewBrowser()).toBe(false);
  localStorage.setItem("fantaspec.squads.v1", "{broken");
  expect(isNewBrowser()).toBe(false);
  localStorage.clear();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(isNewBrowser()).toBe(false);
});

test("squads and selection survive a reload", () => {
  const squads = [{ id: "a", name: "Uno", players: [{ id: 1, name: "Meret" }] }];
  saveSquads(squads);
  saveSelected("a");
  expect(loadSquads()).toEqual(squads);
  expect(loadSelected()).toBe("a");
  expect(localStorage.getItem("fantaspec.squads.v1")).not.toBeNull();
  expect(localStorage.getItem("fantaspec.selected")).toBe("a");
});

test("nothing stored gives no squads and no selection", () => {
  expect(loadSquads()).toEqual([]);
  expect(loadSelected()).toBeNull();
});

test("corrupted or blocked storage gives no squads", () => {
  localStorage.setItem("fantaspec.squads.v1", "{broken");
  expect(loadSquads()).toEqual([]);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(loadSquads()).toEqual([]);
  expect(loadSelected()).toBeNull();
});

test("blocked storage hides even valid squads, without throwing", () => {
  saveSquads([{ id: "a", name: "Uno", players: [] }]);
  saveSelected("a");
  expect(loadSquads()).toHaveLength(1);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(loadSquads()).toEqual([]);
  expect(loadSelected()).toBeNull();
});

test("stored squads with the wrong shape are dropped, valid ones kept", () => {
  const good = { id: "a", name: "Uno", players: [{ id: 1, name: "Meret" }] };
  localStorage.setItem("fantaspec.squads.v1", JSON.stringify([good, { id: "b" }, { id: "c", name: "X", players: [{ id: "1" }] }, null, 7]));
  expect(loadSquads()).toEqual([good]);
  localStorage.setItem("fantaspec.squads.v1", JSON.stringify({ not: "an array" }));
  expect(loadSquads()).toEqual([]);
});

test("blocked or full storage never throws on save", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  expect(() => saveSquads([])).not.toThrow();
  expect(() => saveSelected("a")).not.toThrow();
});

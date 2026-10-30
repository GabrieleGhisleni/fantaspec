import { defaultSquad } from "./defaultSquad";

test("the default squad is the user's team, with a fresh id and its own copy each time", () => {
  const a = defaultSquad();
  const b = defaultSquad();
  expect(a.name).toBe("La mia rosa");
  expect(a.players).toHaveLength(29);
  expect(new Set(a.players.map(p => p.id)).size).toBe(29);
  expect(a.players.slice(0, 2)).toEqual([{ id: 7457, name: "Mascardi" }, { id: 572, name: "Meret" }]);
  expect(a.players.at(-1)).toEqual({ id: 7484, name: "Adams A." });
  expect(a.id).not.toBe(b.id);
  expect(a.players).not.toBe(b.players);
  expect(a.players[0]).not.toBe(b.players[0]);
});

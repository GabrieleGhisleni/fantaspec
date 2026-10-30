import { perGame } from "../format";
import { fullSquad, sampleData, sampleSquad } from "./sampleData";

// Guards the facts that the Squad screen and Squad editor tests rely on.

const { clubs, players } = sampleData;
const byName = (name: string) => Object.values(players).filter(p => p.name === name);
const squadPlayers = (ids: number[]) => ids.map(id => players[String(id)]);

test("every named player exists once, with the expected role and club", () => {
  const expected: [string, string, string | null][] = [
    ["Meret", "P", "napoli"], ["Bastoni", "D", "inter"], ["Dimarco", "D", "inter"], ["Di Lorenzo", "D", "napoli"],
    ["N'Dicka", "D", "roma"], ["Bernardeschi", "C", "juventus"], ["Kean", "A", "juventus"],
    ["Panchinaro", "C", "roma"], ["Senzapartita", "C", "lecce"], ["Partito", "A", null],
  ];
  for (const [name, role, club] of expected) {
    expect(byName(name)).toHaveLength(1);
    expect(byName(name)[0]).toMatchObject({ role, club });
  }
  expect(byName("Meret")[0].id).toBe(572);
  expect(byName("Bernardeschi")[0].id).toBe(184);
});

test("the edge cases are in place", () => {
  expect(byName("Kean")[0].status?.kind).toBe("injured");
  const bench = byName("Panchinaro")[0];
  expect(bench.season).toMatchObject({ pres: 0, medV: null, medFV: null });
  expect(bench.last5.fv.every(v => v === null)).toBe(true);
  expect(clubs.lecce.next).toBeNull();
  expect(byName("Partito")[0].club).toBeNull();
});

test("squads only hold known players, under their data names", () => {
  for (const squad of [sampleSquad, fullSquad]) {
    for (const { id, name } of squad.players) expect(players[String(id)]?.name).toBe(name);
  }
});

test("the screen squad has all four roles and exactly the three defenders", () => {
  const members = squadPlayers(fullSquad.players.map(p => p.id));
  expect([...new Set(members.map(p => p.role))].sort()).toEqual(["A", "C", "D", "P"]);
  expect(members.filter(p => p.role === "D").map(p => p.name).sort()).toEqual(["Bastoni", "Di Lorenzo", "Dimarco"]);
});

test("inter defenders face a weaker attack than Di Lorenzo", () => {
  const opponentGoalsFor = (club: string) => {
    const opponent = clubs[clubs[club].next!.opponent];
    return perGame(opponent.gf, opponent.played);
  };
  expect(opponentGoalsFor("inter")).toBeLessThan(opponentGoalsFor("napoli"));
});

test("the editor searches find exactly one player", () => {
  const names = Object.values(players).map(p => p.name.toLowerCase().replace(/[^a-z]/g, ""));
  expect(names.filter(n => n.includes("mer"))).toEqual(["meret"]);
  expect(names.filter(n => n.includes("ndicka"))).toEqual(["ndicka"]);
  expect(sampleSquad.players.map(p => p.name)).not.toContain("N'Dicka");
});

test("clubs are consistent: the split adds up and opponents exist and point back", () => {
  for (const club of Object.values(clubs)) {
    expect(club.home.played + club.away.played).toBe(club.played);
    expect(club.home.gf + club.away.gf).toBe(club.gf);
    expect(club.home.ga + club.away.ga).toBe(club.ga);
    if (club.next) expect(clubs[club.next.opponent].next?.opponent).toBe(club.key);
  }
});

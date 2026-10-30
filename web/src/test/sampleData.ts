// Small hand-made dataset shared by the web tests. It is a valid AppData (same shape as public/data/*.json)
// and is written so the Squad screen (Task 9) and Squad editor / import (Task 10) tests can lean on it.
//
// Matchday 10, Europe/Rome. Pairings: napoli @ juventus, inter v roma. lecce has no fixture left (next: null).
//
//                 GF/game  GA/game   next
//   napoli          1.56     1.11     @ juventus
//   juventus        1.78     0.67     v napoli
//   inter           2.33     0.78     v roma
//   roma            1.00     1.22     @ inter
//   lecce           0.67     1.78     -
//
// So a defender (matchup = opponent GF/game) has the easiest game at inter (roma, 1.0) and the hardest at
// napoli (juventus, 1.78): Bastoni and Dimarco (same club, tie broken by name) before Di Lorenzo.
import type { AppData, ClubData, PlayerData } from "../types";
import type { Squad } from "../squads";

const clubs: ClubData[] = [
  {
    key: "napoli", name: "Napoli", position: 4, points: 17, played: 9, form: ["L", "L", "W", "D", "W"], gf: 14, ga: 10,
    home: { played: 5, gf: 8, ga: 3 }, away: { played: 4, gf: 6, ga: 7 },
    next: { opponent: "juventus", home: false, kickoff: "2026-10-31T18:00:00+01:00", matchday: 10, h2h: ["W", "D", "L", "D", "L"] },
  },
  {
    key: "juventus", name: "Juventus", position: 2, points: 20, played: 9, form: ["W", "W", "D", "W", "W"], gf: 16, ga: 6,
    home: { played: 5, gf: 10, ga: 2 }, away: { played: 4, gf: 6, ga: 4 },
    next: { opponent: "napoli", home: true, kickoff: "2026-10-31T18:00:00+01:00", matchday: 10, h2h: ["L", "D", "W", "D", "W"] },
  },
  {
    key: "inter", name: "Inter", position: 1, points: 22, played: 9, form: ["W", "W", "W", "D", "W"], gf: 21, ga: 7,
    home: { played: 4, gf: 11, ga: 3 }, away: { played: 5, gf: 10, ga: 4 },
    next: { opponent: "roma", home: true, kickoff: "2026-11-01T20:45:00+01:00", matchday: 10, h2h: ["W", "W", "D", "W", "L"] },
  },
  {
    key: "roma", name: "Roma", position: 7, points: 14, played: 9, form: ["D", "L", "W", "D", "L"], gf: 9, ga: 11,
    home: { played: 5, gf: 6, ga: 5 }, away: { played: 4, gf: 3, ga: 6 },
    next: { opponent: "inter", home: false, kickoff: "2026-11-01T20:45:00+01:00", matchday: 10, h2h: ["L", "L", "D", "L", "W"] },
  },
  {
    key: "lecce", name: "Lecce", position: 18, points: 6, played: 9, form: ["L", "L", "D", "L", "L"], gf: 6, ga: 16,
    home: { played: 5, gf: 4, ga: 8 }, away: { played: 4, gf: 2, ga: 8 },
    next: null,
  },
];

type Stats = Partial<PlayerData["season"]>;
type Opts = { status?: PlayerData["status"]; startPct?: number | null; fv?: (number | null)[]; g?: number; a?: number; gs?: number };

function player(id: number, name: string, role: PlayerData["role"], club: string | null, season: Stats, o: Opts = {}): PlayerData {
  const fv = o.fv ?? [];
  return {
    id, name, club, role,
    season: { pres: 0, medV: null, medFV: null, g: 0, gs: 0, a: 0, cs: role === "C" || role === "A" ? null : 0, ...season },
    last5: { played: fv.filter(v => v !== null).length, g: o.g ?? 0, gs: o.gs ?? 0, a: o.a ?? 0, fv },
    status: o.status ?? null,
    startPct: o.startPct ?? null,
  };
}

const players: PlayerData[] = [
  player(572, "Meret", "P", "napoli", { pres: 9, medV: 6.0, medFV: 6.5, gs: 10, cs: 3 }, { fv: [5.0, 6.0, 7.0, 4.0, 6.0], gs: 6, startPct: 95 }),
  player(2816, "Di Lorenzo", "D", "napoli", { pres: 9, medV: 6.0, medFV: 6.8, g: 1, a: 2, cs: 3 }, { fv: [6.5, 7.0, null, 6.0, 8.5], g: 1, a: 1, startPct: 90 }),
  player(2120, "Bastoni", "D", "inter", { pres: 8, medV: 6.5, medFV: 7.0, g: 1, a: 1, cs: 4 }, { fv: [6.5, 7.0, 7.5, null, 7.0], startPct: 85 }),
  player(254, "Dimarco", "D", "inter", { pres: 9, medV: 6.5, medFV: 7.5, g: 2, a: 4, cs: 4 }, { fv: [8.0, 7.0, 7.5, 6.5, 8.5], g: 1, a: 2, startPct: 60, status: { kind: "doubtful", text: "" } }),
  player(4317, "N'Dicka", "D", "roma", { pres: 8, medV: 6.0, medFV: 6.2, cs: 3 }, { fv: [5.5, 6.0, 6.0, 6.0, 6.0], startPct: 70 }),
  player(184, "Bernardeschi", "C", "juventus", { pres: 8, medV: 6.25, medFV: 6.4, g: 2 }, { fv: [10.0, null, 5.5, 9.5, 6.0], g: 2, startPct: 80 }),
  // Never voted this season: a new signing who is always on the bench.
  player(9001, "Panchinaro", "C", "roma", {}, { fv: [null, null, null, null, null], startPct: 0 }),
  // His club has no fixture left, so there is no opponent and no lineup.
  player(9002, "Senzapartita", "C", "lecce", { pres: 6, medV: 6.0, medFV: 6.3, g: 1, a: 1 }, { fv: [6.0, null, 6.5, 6.0, 6.5], g: 1, a: 1 }),
  player(2097, "Kean", "A", "juventus", { pres: 7, medV: 6.5, medFV: 7.8, g: 4, a: 1 }, {
    fv: [9.5, 6.0, null, 8.5, 7.0], g: 3, a: 1, startPct: 0,
    status: { kind: "injured", text: "rientro da metà novembre" },
  }),
  // Left Serie A: no club, no fixtures, no lineup.
  player(9003, "Partito", "A", null, { pres: 4, medV: 5.8, medFV: 6.1, g: 1 }),
];

const byKey = <T extends { key: string }>(list: T[]) => Object.fromEntries(list.map(item => [item.key, item]));

export const sampleData: AppData = {
  meta: {
    season: "2026-27",
    updatedAt: "2026-10-31T10:07:12+01:00",
    lastRun: { at: "2026-10-31T10:07:12+01:00", kind: "light", ok: true, errors: [] },
    nextMatchday: { number: 10, from: "2026-10-31", to: "2026-11-02" },
  },
  clubs: byKey(clubs),
  players: Object.fromEntries(players.map(p => [String(p.id), p])),
};

/** A small squad for the editor and import tests. It leaves out N'Dicka on purpose, so he only shows up as a search result. */
export const sampleSquad: Squad = {
  id: "sq-ghisleni",
  name: "FC Ghisleni",
  players: [{ id: 572, name: "Meret" }, { id: 184, name: "Bernardeschi" }, { id: 2097, name: "Kean" }],
};

/**
 * The squad for the Squad screen tests: every role, exactly three defenders (Bastoni, Dimarco, Di Lorenzo),
 * plus the edge cases: Kean is injured, Panchinaro never got a vote, Senzapartita's club has no fixture left,
 * Partito left Serie A.
 */
export const fullSquad: Squad = {
  id: "sq-completa",
  name: "Rosa completa",
  players: [572, 2816, 2120, 254, 184, 9001, 9002, 2097, 9003].map(id => ({ id, name: sampleData.players[String(id)].name })),
};

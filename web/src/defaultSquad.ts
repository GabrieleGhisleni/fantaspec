import { newId, type Squad, type SquadPlayer } from "./squads";

// The user's own team: a browser that never saved squads starts with it (see App).
// 4 P, 9 D, 9 C, 7 A, in that order.
const NAME = "La mia rosa";
const PLAYERS: readonly SquadPlayer[] = [
  { id: 7457, name: "Mascardi" },
  { id: 572, name: "Meret" },
  { id: 2170, name: "Milinkovic-Savic V." },
  { id: 4957, name: "Montipò" },
  { id: 6217, name: "Bisseck" },
  { id: 7469, name: "Bracaglia" },
  { id: 2788, name: "Bremer" },
  { id: 4734, name: "Miranda J." },
  { id: 5526, name: "Scalvini" },
  { id: 6727, name: "Couto" },
  { id: 6664, name: "Delprato" },
  { id: 5862, name: "Valeri" },
  { id: 554, name: "Zappacosta" },
  { id: 184, name: "Bernardeschi" },
  { id: 5500, name: "Cancellieri" },
  { id: 5559, name: "Da Cunha" },
  { id: 2517, name: "De Bruyne" },
  { id: 2741, name: "Pessina" },
  { id: 536, name: "Politano" },
  { id: 5735, name: "Volpato" },
  { id: 1870, name: "Barella" },
  { id: 6666, name: "Bernabè" },
  { id: 6669, name: "Bonny" },
  { id: 7347, name: "Bowie" },
  { id: 5995, name: "De Ketelaere" },
  { id: 309, name: "Dybala" },
  { id: 7523, name: "Varela G." },
  { id: 6434, name: "Yildiz" },
  { id: 7484, name: "Adams A." },
];

/** A fresh copy of the default squad, with a new id. */
export function defaultSquad(): Squad {
  return { id: newId(), name: NAME, players: PLAYERS.map(p => ({ ...p })) };
}

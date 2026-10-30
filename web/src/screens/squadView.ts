// Pure helpers behind the Squad screen: what each row shows and how rows are ordered.
import { perGame, tertile } from "../format";
import type { Squad } from "../squads";
import type { AppData, ClubData, PlayerData, Result, Role } from "../types";

export type Matchup = {
  label: "avv. segna" | "avv. subisce";
  /** Opponent goals scored (P, D) or conceded (C, A) per game. */
  value: number;
  tone: "good" | "bad" | "";
  /** Share of all clubs the opponent is easier than (0-1, higher is better), so roles can be compared. */
  score: number;
};

export type Row = {
  id: number;
  /** The data name, or the name stored in the squad when the player is gone from the data. */
  name: string;
  /** null when the id is no longer in players.json. */
  player: PlayerData | null;
  /** null when the player left Serie A (or is gone from the data). */
  club: ClubData | null;
  /** The club's next opponent; null when there is no fixture left. */
  opponent: ClubData | null;
  matchup: Matchup | null;
};

export type SortKey = "role" | "start" | "fv" | "matchup";

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "role", label: "Per ruolo" },
  { key: "start", label: "Titolarità" },
  { key: "fv", label: "FV mediana" },
  { key: "matchup", label: "Sfida" },
];

export const ROLE_GROUPS: { role: Role; title: string }[] = [
  { role: "P", title: "Portieri" },
  { role: "D", title: "Difensori" },
  { role: "C", title: "Centrocampisti" },
  { role: "A", title: "Attaccanti" },
];

/** Goalkeepers and defenders care about the opponent's attack, midfielders and forwards about its defence. */
export function matchup(role: Role, opponent: ClubData, clubs: ClubData[]): Matchup {
  const attack = role === "P" || role === "D";
  const perMatch = (c: ClubData) => perGame(attack ? c.gf : c.ga, c.played);
  const value = perMatch(opponent);
  const all = clubs.map(perMatch);
  const easierThan = all.filter(v => (attack ? v > value : v < value)).length;
  return {
    label: attack ? "avv. segna" : "avv. subisce",
    value,
    // A weak attack helps a defender; a leaky defence helps a forward.
    tone: tertile(value, all, !attack),
    score: easierThan / all.length,
  };
}

export function buildRows(squad: Squad, data: AppData): Row[] {
  const clubs = Object.values(data.clubs);
  return squad.players.map(({ id, name }) => {
    const player = data.players[String(id)] ?? null;
    const club = (player?.club && data.clubs[player.club]) || null;
    const opponent = (club?.next && data.clubs[club.next.opponent]) || null;
    return {
      id,
      name: player?.name ?? name,
      player,
      club,
      opponent,
      matchup: player && opponent ? matchup(player.role, opponent, clubs) : null,
    };
  });
}

const roleIndex = (r: Row) => {
  const i = ROLE_GROUPS.findIndex(g => g.role === r.player?.role);
  return i < 0 ? ROLE_GROUPS.length : i;
};

const byRoleThenName = (a: Row, b: Row) => roleIndex(a) - roleIndex(b) || a.name.localeCompare(b.name, "it");

const SORT_VALUE: Record<Exclude<SortKey, "role">, (r: Row) => number | null> = {
  start: r => r.player?.startPct ?? null,
  fv: r => r.player?.season.medFV ?? null,
  matchup: r => r.matchup?.score ?? null,
};

/** Highest first with missing values last; ties keep the role order, then the name. */
export function sortRows(rows: Row[], sort: SortKey): Row[] {
  const sorted = [...rows].sort(byRoleThenName);
  if (sort === "role") return sorted;
  const value = SORT_VALUE[sort];
  return sorted.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    return vb - va;
  });
}

const MIRROR: Record<Result, Result> = { W: "L", D: "D", L: "W" };

/** The same results seen from the other club's side. */
export function mirror(results: Result[]): Result[] {
  return results.map(r => MIRROR[r]);
}

import type { PlayerData, Role } from "./types";

export type Filters = {
  query: string;
  /** null for every role. */
  role: Role | null;
  /** Club key; "" for every club. */
  club: string;
};

const MIN_QUERY = 2;
export const ROLE_ORDER: Record<Role, number> = { P: 0, D: 1, C: 2, A: 3 };

/** Lower-case letters and digits only, accents removed: "N'Dicka" -> "ndicka", "Montipò" -> "montipo". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The players matching the filters: names that start with the query first, then by role and name.
 * null (no search yet) until the query has two letters or a club is picked.
 */
export function searchPlayers(players: PlayerData[], { query, role, club }: Filters): PlayerData[] | null {
  const q = normalize(query);
  if (q.length < MIN_QUERY && !club) return null;
  return players
    .map(player => ({ player, name: normalize(player.name) }))
    .filter(({ player, name }) => (!role || player.role === role) && (!club || player.club === club) && name.includes(q))
    .map(({ player, name }) => ({ player, starts: name.startsWith(q) }))
    .sort((a, b) => Number(b.starts) - Number(a.starts)
      || ROLE_ORDER[a.player.role] - ROLE_ORDER[b.player.role]
      || a.player.name.localeCompare(b.player.name, "it"))
    .map(({ player }) => player);
}

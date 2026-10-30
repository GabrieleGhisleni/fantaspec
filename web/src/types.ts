// Mirrors the JSON written by the pipeline into public/data/ (meta.json, clubs.json, players.json).

export type Role = "P" | "D" | "C" | "A";

/** One result seen from a club's side: Win, Draw, Loss. Always oldest to newest in lists. */
export type Result = "W" | "D" | "L";

export type LastRun = {
  at: string;
  kind: "light" | "full";
  ok: boolean;
  errors: string[];
};

export type Meta = {
  season: string;
  /** Changes only when the site data changed. */
  updatedAt: string;
  lastRun: LastRun;
  /** null when no unplayed fixture is left. */
  nextMatchday: { number: number; from: string; to: string } | null;
};

export type Split = { played: number; gf: number; ga: number };

export type NextMatch = {
  /** Club key of the opponent. */
  opponent: string;
  home: boolean;
  kickoff: string;
  matchday: number;
  /** Last (up to) 5 meetings, from this club's side; may be shorter or empty. */
  h2h: Result[];
};

export type ClubData = {
  key: string;
  name: string;
  position: number;
  points: number;
  played: number;
  form: Result[];
  gf: number;
  ga: number;
  home: Split;
  away: Split;
  /** null when the club has no unplayed fixture left. */
  next: NextMatch | null;
};

export type PlayerStatus = {
  kind: "suspended" | "injured" | "doubtful" | "warned";
  text: string;
};

export type PlayerData = {
  id: number;
  name: string;
  /** Club key; null for a player no longer on the fantacalcio roster. */
  club: string | null;
  role: Role;
  season: {
    pres: number;
    /** null when pres is 0. */
    medV: number | null;
    /** null when pres is 0. */
    medFV: number | null;
    g: number;
    gs: number;
    a: number;
    /** null for roles C and A. */
    cs: number | null;
  };
  last5: {
    played: number;
    g: number;
    gs: number;
    a: number;
    /** One entry per match in the club's last (up to) 5, oldest first; null where the player had no vote. */
    fv: (number | null)[];
  };
  /** null when the player has no status. */
  status: PlayerStatus | null;
  /** 0-100 when the club's next match is on the lineups page, null otherwise. */
  startPct: number | null;
};

export type AppData = {
  meta: Meta;
  /** Keyed by club slug. */
  clubs: Record<string, ClubData>;
  /** Keyed by player id as a string. */
  players: Record<string, PlayerData>;
};

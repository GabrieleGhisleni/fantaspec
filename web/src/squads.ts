export type SquadPlayer = { id: number; name: string };
export type Squad = { id: string; name: string; players: SquadPlayer[] };

const SQUADS_KEY = "fantaspec.squads.v1";
const SELECTED_KEY = "fantaspec.selected";

// Storage can be missing, blocked, full or hold garbage: every access is guarded and falls back silently.

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nowhere to save: the app keeps working with what it has in memory.
  }
}

function isSquadPlayer(v: unknown): v is SquadPlayer {
  const p = v as SquadPlayer | null;
  return typeof p === "object" && p !== null && Number.isInteger(p.id) && typeof p.name === "string";
}

function isSquad(v: unknown): v is Squad {
  const s = v as Squad | null;
  return typeof s === "object" && s !== null && typeof s.id === "string" && typeof s.name === "string"
    && Array.isArray(s.players) && s.players.every(isSquadPlayer);
}

export function newId(): string {
  // randomUUID only exists in secure contexts (not on a phone opening the dev server over http).
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadSquads(): Squad[] {
  try {
    const parsed: unknown = JSON.parse(readStorage(SQUADS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isSquad) : [];
  } catch {
    return [];
  }
}

export function saveSquads(squads: Squad[]): void {
  writeStorage(SQUADS_KEY, JSON.stringify(squads));
}

export function loadSelected(): string | null {
  return readStorage(SELECTED_KEY);
}

export function saveSelected(id: string): void {
  writeStorage(SELECTED_KEY, id);
}

// Share link payload: base64url of the UTF-8 JSON {"n": name, "p": [[id, name], ...]}.

export function encodeShare(squad: Squad): string {
  const json = JSON.stringify({ n: squad.name, p: squad.players.map(p => [p.id, p.name]) });
  let binary = "";
  for (const byte of new TextEncoder().encode(json)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The squad in a share link (with a fresh id), or null when the link is not one of ours. */
export function decodeShare(param: string): Squad | null {
  try {
    const base64 = param.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const { n, p } = payload as { n?: unknown; p?: unknown };
    if (typeof n !== "string" || !Array.isArray(p)) return null;
    const players: SquadPlayer[] = [];
    for (const entry of p) {
      if (!Array.isArray(entry)) return null;
      const player = { id: entry[0], name: entry[1] };
      if (!isSquadPlayer(player)) return null;
      players.push(player);
    }
    return { id: newId(), name: n, players };
  } catch {
    return null;
  }
}

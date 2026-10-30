import { useMemo, useState } from "react";
import { searchPlayers } from "../search";
import type { AppData, PlayerData, Role } from "../types";

/** More results than this and the list asks to refine the search instead. */
const LIMIT = 50;

type Chip = "Tutti" | Role;
const CHIPS: Chip[] = ["Tutti", "P", "D", "C", "A"];

type PickProps = {
  data: AppData;
  /** undefined for a player gone from the data. */
  player: PlayerData | undefined;
  name: string;
  /** The sign at the end of the row: what a tap does. */
  mark: string;
  pressed?: boolean;
  label?: string;
  onClick: () => void;
};

/** One tappable player line: role, name, club, and a mark. */
export function PickButton({ data, player, name, mark, pressed, label, onClick }: PickProps) {
  const club = player?.club ? data.clubs[player.club]?.name ?? "" : "non più in Serie A";
  return (
    <button type="button" className="pick" aria-pressed={pressed} aria-label={label} onClick={onClick}>
      <span className={player ? `role role-${player.role}` : "role"}>{player?.role ?? "–"}</span>
      <span className="player-name">{name}</span>
      <span className="pick-club">{club}</span>
      <span className="pick-mark" aria-hidden="true">{mark}</span>
    </button>
  );
}

type Props = {
  data: AppData;
  /** Ids already in the squad: shown as picked. */
  picked: ReadonlySet<number>;
  /** A tap on a result: add the player, or take him out when already picked. */
  onToggle: (player: PlayerData) => void;
};

/** Search over every player by name, narrowed by role chips and a club select. */
export function PlayerSearch({ data, picked, onToggle }: Props) {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<Chip>("Tutti");
  const [club, setClub] = useState("");

  const clubs = useMemo(() => Object.values(data.clubs).sort((a, b) => a.name.localeCompare(b.name, "it")), [data]);
  const found = useMemo(
    () => searchPlayers(Object.values(data.players), { query, role: chip === "Tutti" ? null : chip, club }),
    [data, query, chip, club],
  );

  return (
    <div className="search">
      <input
        type="search"
        className="field"
        aria-label="Cerca giocatore"
        placeholder="Cerca giocatore"
        autoComplete="off"
        enterKeyHint="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="chips" role="group" aria-label="Ruolo">
        {CHIPS.map(c => (
          <button key={c} type="button" className="chip" aria-pressed={chip === c} onClick={() => setChip(c)}>{c}</button>
        ))}
      </div>
      <select className="club-select" aria-label="Squadra" value={club} onChange={e => setClub(e.target.value)}>
        <option value="">Tutte le squadre</option>
        {clubs.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
      </select>
      {found?.length === 0 && <p className="status">Nessun giocatore</p>}
      {found && found.length > 0 && (
        <ul className="picks" aria-label="Risultati">
          {found.slice(0, LIMIT).map(p => (
            <li key={p.id}>
              <PickButton
                data={data}
                player={p}
                name={p.name}
                mark={picked.has(p.id) ? "✓" : "+"}
                pressed={picked.has(p.id)}
                onClick={() => onToggle(p)}
              />
            </li>
          ))}
        </ul>
      )}
      {found && found.length > LIMIT && (
        <p className="status">{`Altri ${found.length - LIMIT} giocatori: affina la ricerca`}</p>
      )}
    </div>
  );
}

import { Fragment, useId, useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MatchCards } from "../components/MatchCards";
import { PlayerRow } from "../components/PlayerRow";
import { dateRange, dayTime } from "../format";
import type { Squad } from "../squads";
import type { AppData, Role } from "../types";
import { buildRows, ROLE_GROUPS, SORTS, sortRows, type Row, type SortKey } from "./squadView";

type Props = {
  data: AppData;
  squads: Squad[];
  selectedId: string;
  onSelect: (id: string) => void;
};

type Chip = "Tutti" | Role;
const CHIPS: Chip[] = ["Tutti", "P", "D", "C", "A"];

/** Home: the selected squad's players with their next match, filtered by role and sorted. */
export function SquadScreen({ data, squads, selectedId, onSelect }: Props) {
  const [chip, setChip] = useState<Chip>("Tutti");
  const [sort, setSort] = useState<SortKey>("role");
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const sortId = useId();

  const squad = squads.find(s => s.id === selectedId) ?? squads[0];
  if (!squad) return null;

  const { meta } = data;
  const rows = sortRows(buildRows(squad, data), "role");
  const visible = sortRows(rows.filter(r => chip === "Tutti" || r.player?.role === chip), sort);

  function toggle(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  const list = (items: Row[]) => (
    <ul className="rows">
      {items.map(r => (
        <ErrorBoundary
          key={r.id}
          fallback={(
            <li className="row">
              <div className="row-main">
                <span className="player-name">{r.name}</span> <span className="muted">dati non disponibili</span>
              </div>
            </li>
          )}
        >
          <PlayerRow row={r} open={expanded.has(r.id)} onToggle={() => toggle(r.id)} />
        </ErrorBoundary>
      ))}
    </ul>
  );

  let body;
  if (visible.length === 0) {
    body = <p className="status">Nessun giocatore</p>;
  } else if (sort === "role") {
    const ungrouped = visible.filter(r => !ROLE_GROUPS.some(g => g.role === r.player?.role));
    body = (
      <>
        {ROLE_GROUPS.map(({ role, title }) => {
          const items = visible.filter(r => r.player?.role === role);
          return items.length > 0 && (
            <Fragment key={role}>
              <h2 className="group-title">{title}</h2>
              {list(items)}
            </Fragment>
          );
        })}
        {ungrouped.length > 0 && list(ungrouped)}
      </>
    );
  } else {
    body = list(visible);
  }

  return (
    <div className="squad-screen">
      <header className="squad-header">
        <div className="controls">
          <select className="squad-select" aria-label="Rosa" value={squad.id} onChange={e => onSelect(e.target.value)}>
            {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="sort-label" htmlFor={sortId}>Ordina</label>
          <select id={sortId} className="sort-select" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        {meta.nextMatchday && (
          <p className="matchday">{`Giornata ${meta.nextMatchday.number} · ${dateRange(meta.nextMatchday.from, meta.nextMatchday.to)}`}</p>
        )}
        <p className="updated">{`Aggiornato ${dayTime(meta.updatedAt)}`}</p>
        {!meta.lastRun.ok && (
          <p className="banner" role="alert">{`Ultimo aggiornamento non riuscito: dati del ${dayTime(meta.updatedAt)}`}</p>
        )}
      </header>
      <MatchCards rows={rows} />
      <div className="chips" role="group" aria-label="Ruolo">
        {CHIPS.map(c => (
          <button key={c} type="button" className="chip" aria-pressed={chip === c} onClick={() => setChip(c)}>{c}</button>
        ))}
      </div>
      {body}
    </div>
  );
}

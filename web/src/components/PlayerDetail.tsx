import type { ReactNode } from "react";
import { num1 } from "../format";
import type { Row } from "../screens/squadView";
import type { PlayerData } from "../types";
import { ClubCompare } from "./ClubCompare";
import { Sparkline } from "./Sparkline";

/** A keeper's goals conceded count against him: shown negative, in red. */
function Conceded({ n }: { n: number }) {
  return n > 0 ? <span className="bad">{`−${n}`}</span> : <span>0</span>;
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The expanded part of a row: season numbers, the last 5 with the trend, then the club against its next opponent. */
export function PlayerDetail({ row, player }: { row: Row; player: PlayerData }) {
  const { season, last5 } = player;
  const keeper = player.role === "P";
  const next = row.club?.next;
  return (
    <div className="detail">
      {player.status?.text && <p className="status-note">{player.status.text}</p>}
      <dl className="stats">
        <Stat label="Pres">{season.pres}</Stat>
        <Stat label="Med V">{num1(season.medV)}</Stat>
        <Stat label="Med FV">{num1(season.medFV)}</Stat>
        {keeper ? <Stat label="Gol sub."><Conceded n={season.gs} /></Stat> : <Stat label="Gol">{season.g}</Stat>}
        <Stat label="Assist">{season.a}</Stat>
        {season.cs !== null && <Stat label="Imbattuto">{season.cs}</Stat>}
      </dl>
      {last5.fv.length > 0 && (
        <p className="last5">
          <span className="muted">Ultime 5</span>
          <Sparkline values={last5.fv} />
          <span className="trend-values">{last5.fv.map(num1).join(" ")}</span>
          <span className="last5-numbers">
            <span>pres. <strong>{`${last5.played}/${last5.fv.length}`}</strong></span>
            {keeper
              ? <span>gol sub. <Conceded n={last5.gs} /></span>
              : <span>gol <strong>{last5.g}</strong></span>}
            <span>assist <strong>{last5.a}</strong></span>
          </span>
        </p>
      )}
      {row.club && row.opponent && next && (
        <ClubCompare club={row.club} opponent={row.opponent} home={next.home} h2h={next.h2h} />
      )}
    </div>
  );
}

import { num1 } from "../format";
import type { Row } from "../screens/squadView";
import type { PlayerData } from "../types";
import { ClubCompare } from "./ClubCompare";
import { Sparkline } from "./Sparkline";

/** A keeper's goals conceded count against him: shown negative, in red. */
function Conceded({ n }: { n: number }) {
  return n > 0 ? <span className="bad">−{n}</span> : <span>0</span>;
}

/** The expanded part of a row: season and last-5 numbers, the trend, then the club against its next opponent. */
export function PlayerDetail({ row, player }: { row: Row; player: PlayerData }) {
  const { season, last5 } = player;
  const keeper = player.role === "P";
  const next = row.club?.next;
  return (
    <div className="detail">
      {player.status?.text && <p className="status-note">{player.status.text}</p>}
      <table className="stats">
        <thead>
          <tr>
            <td />
            <th scope="col">Stagione</th>
            <th scope="col">Ultime 5</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Pres</th>
            <td>{season.pres}</td>
            <td>{last5.fv.length > 0 ? `${last5.played}/${last5.fv.length}` : "–"}</td>
          </tr>
          <tr>
            <th scope="row">Med V</th>
            <td>{num1(season.medV)}</td>
            <td />
          </tr>
          <tr>
            <th scope="row">Med FV</th>
            <td>{num1(season.medFV)}</td>
            <td />
          </tr>
          <tr>
            <th scope="row">{keeper ? "Gol sub." : "Gol"}</th>
            <td>{keeper ? <Conceded n={season.gs} /> : season.g}</td>
            <td>{keeper ? <Conceded n={last5.gs} /> : last5.g}</td>
          </tr>
          <tr>
            <th scope="row">Assist</th>
            <td>{season.a}</td>
            <td>{last5.a}</td>
          </tr>
          {season.cs !== null && (
            <tr>
              <th scope="row">Imbattuto</th>
              <td>{season.cs}</td>
              <td />
            </tr>
          )}
        </tbody>
      </table>
      {last5.fv.length > 0 && (
        <p className="trend">
          <span className="muted">FV ultime 5</span>
          <Sparkline values={last5.fv} />
          <span className="trend-values">{last5.fv.map(num1).join(" ")}</span>
        </p>
      )}
      {row.club && row.opponent && next && (
        <ClubCompare club={row.club} opponent={row.opponent} home={next.home} h2h={next.h2h} />
      )}
    </div>
  );
}

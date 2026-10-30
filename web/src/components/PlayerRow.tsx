import { num1, startClass } from "../format";
import type { Row } from "../screens/squadView";
import type { PlayerStatus } from "../types";
import { PlayerDetail } from "./PlayerDetail";

const STATUS: Record<PlayerStatus["kind"], string> = {
  suspended: "squalificato",
  injured: "infortunato",
  doubtful: "in dubbio",
  warned: "diffidato",
};

/** Where the player's next match is: "@ Juventus 2°", or why there is none. */
function fixtureText({ club, opponent }: Row): string {
  if (!club) return "non più in Serie A";
  if (!club.next || !opponent) return "nessuna partita";
  return `${club.next.home ? "vs" : "@"} ${opponent.name} ${opponent.position}°`;
}

type Props = { row: Row; open: boolean; onToggle: () => void };

/** One player: two compact lines; a tap expands the detail in place. */
export function PlayerRow({ row, open, onToggle }: Props) {
  const { player, matchup } = row;

  if (!player) {
    // Gone from the data altogether: only the name the squad stored is left.
    return (
      <li className="row">
        <div className="row-main">
          <span className="line1">
            <span className="role">–</span>
            <span className="player-name">{row.name}</span>
          </span>
          <span className="line2">
            <span>{fixtureText(row)}</span>
          </span>
        </div>
      </li>
    );
  }

  return (
    <li className="row">
      <button type="button" className="row-main" aria-expanded={open} onClick={onToggle}>
        <span className="line1">
          <span className={`role role-${player.role}`}>{player.role}</span>
          <span className="player-name">{row.name}</span>
          {player.status && <span className={`tag tag-${player.status.kind}`}>{STATUS[player.status.kind]}</span>}
          {player.startPct !== null && <span className={`start ${startClass(player.startPct)}`}>{`${player.startPct}%`}</span>}
          <span className="chevron" aria-hidden="true">▾</span>
        </span>
        <span className="line2">
          <span>{fixtureText(row)}</span>
          <span>{`FV ${num1(player.season.medFV)}`}</span>
          {matchup && <span className={`matchup ${matchup.tone}`}>{`${matchup.label} ${num1(matchup.value)}`}</span>}
        </span>
      </button>
      {open && <PlayerDetail row={row} player={player} />}
    </li>
  );
}

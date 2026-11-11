import { num1, perGame, startClass } from "../format";
import type { Row } from "../screens/squadView";
import type { ClubData, PlayerStatus } from "../types";
import { FormPills } from "./FormPills";

const STATUS: Record<PlayerStatus["kind"], string> = {
  suspended: "squalificato",
  injured: "infortunato",
  doubtful: "in dubbio",
  warned: "diffidato",
};

/** "Napoli 1° · 24 pt" */
const standing = (c: ClubData) => `${c.name} ${c.position}° · ${c.points} pt`;

/** The player's club and its next opponent, each with league position and points, and where the match is played. */
function Fixture({ club, opponent }: Pick<Row, "club" | "opponent">) {
  if (!club) return <span className="fixture">non più in Serie A</span>;
  if (!club.next || !opponent) return <span className="fixture">nessuna partita</span>;
  return (
    <span className="fixture">
      <span className="fixture-club">{standing(club)}</span>
      <span className="fixture-vs">
        {club.next.home ? "in casa contro " : "in trasferta a "}
        {standing(opponent)}
      </span>
    </span>
  );
}

/** Form of the player's club and of the next opponent, last matches oldest first. */
function Form({ club, opponent }: { club: ClubData; opponent: ClubData | null }) {
  return (
    <span className="form">
      <span className="muted">Forma </span>
      <FormPills results={club.form} />
      {opponent && <> <span className="muted">· </span><FormPills results={opponent.form} /></>}
    </span>
  );
}

/** Goals per game, scored and conceded, for the club and its opponent this season. */
function GoalsLine({ club, opponent }: { club: ClubData; opponent: ClubData }) {
  const pair = (c: ClubData) => `${c.name} ${num1(perGame(c.gf, c.played))} / ${num1(perGame(c.ga, c.played))}`;
  return <span className="goals">{`Gol a partita (fatti / subiti): ${pair(club)} · ${pair(opponent)}`}</span>;
}

/** The player's season numbers in one line. A keeper's goals conceded count against him: shown negative, in red. */
function SeasonLine({ player }: { player: NonNullable<Row["player"]> }) {
  const { season } = player;
  const keeper = player.role === "P";
  return (
    <span>
      {keeper
        ? <>Gol subiti {season.gs > 0 ? <span className="bad">{`−${season.gs}`}</span> : "0"}</>
        : <>Gol {season.g}</>}
      {` · Assist ${season.a} · Presenze ${season.pres} · FV mediana ${num1(season.medFV)}`}
    </span>
  );
}

/** One player, summarised: name and status, the fixture, form, goals, season numbers and the fantavote median. */
export function PlayerRow({ row }: { row: Row }) {
  const { player, matchup, club, opponent } = row;

  if (!player) {
    // Gone from the data altogether: only the name the squad stored is left.
    return (
      <li className="row">
        <div className="row-main">
          <span className="line1">
            <span className="role">–</span>
            <span className="player-name">{row.name}</span>
          </span>
          <Fixture club={row.club} opponent={row.opponent} />
        </div>
      </li>
    );
  }

  return (
    <li className="row">
      <div className="row-main">
        <span className="line1">
          <span className={`role role-${player.role}`}>{player.role}</span>
          <span className="player-name">{row.name}</span>
          {player.status && <span className={`tag tag-${player.status.kind}`}>{STATUS[player.status.kind]}</span>}
          {player.startPct !== null && <span className={`start ${startClass(player.startPct)}`}>{`tit. ${player.startPct}%`}</span>}
        </span>
        <Fixture club={club} opponent={opponent} />
        {club && <Form club={club} opponent={opponent} />}
        {club && opponent && <GoalsLine club={club} opponent={opponent} />}
        {player.status?.text && <span className="status-note">{player.status.text}</span>}
        <span className="line2">
          <SeasonLine player={player} />
          {matchup && <span className={`matchup ${matchup.tone}`}>{`${matchup.label} ${num1(matchup.value)}`}</span>}
        </span>
      </div>
    </li>
  );
}

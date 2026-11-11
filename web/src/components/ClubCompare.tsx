import type { ReactNode } from "react";
import { num1, perGame } from "../format";
import type { ClubData, Result, Split } from "../types";
import { FormPills } from "./FormPills";

type Props = {
  club: ClubData;
  opponent: ClubData;
  /** Whether `club` plays the match at home. */
  home: boolean;
  /** Last meetings from `club`'s side, oldest first. */
  h2h: Result[];
};

const scored = (s: Pick<Split, "gf" | "played">) => num1(perGame(s.gf, s.played));
const conceded = (s: Pick<Split, "ga" | "played">) => num1(perGame(s.ga, s.played));

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Napoli: 2 vittorie, 1 pareggio, 2 sconfitte", from `club`'s side. */
function h2hSummary(name: string, h2h: Result[]): string {
  const count = (r: Result) => h2h.filter(x => x === r).length;
  return `${name}: ${plural(count("W"), "vittoria", "vittorie")}, ${plural(count("D"), "pareggio", "pareggi")}, ${plural(count("L"), "sconfitta", "sconfitte")}`;
}

/**
 * Club and opponent side by side. The season block first (per game over the whole season), then the venue block
 * for this match only (the club's home games against the opponent's away games, or the reverse), then the meetings.
 */
export function ClubCompare({ club, opponent, home, h2h }: Props) {
  const row = (label: string, ours: ReactNode, theirs: ReactNode, className?: string) => (
    <tr className={className}>
      <th scope="row">{label}</th>
      <td>{ours}</td>
      <td>{theirs}</td>
    </tr>
  );
  const ourVenue = home ? club.home : club.away;
  const theirVenue = home ? opponent.away : opponent.home;
  const homeName = home ? club.name : opponent.name;
  const awayName = home ? opponent.name : club.name;
  return (
    <table className="compare">
      <thead>
        <tr>
          <td />
          <th scope="col">{club.name}</th>
          <th scope="col">{opponent.name}</th>
        </tr>
      </thead>
      <tbody>
        <tr className="group">
          <th colSpan={3} scope="colgroup">Tutta la stagione (medie a partita)</th>
        </tr>
        {row("Classifica", `${club.position}° · ${club.points} pt`, `${opponent.position}° · ${opponent.points} pt`)}
        {row("Forma", <FormPills results={club.form} />, <FormPills results={opponent.form} />)}
        {row("Gol segnati", scored(club), scored(opponent))}
        {row("Gol subiti", conceded(club), conceded(opponent))}
        <tr className="group">
          <th colSpan={3} scope="colgroup">
            Solo questa partita: {homeName} gioca in casa, {awayName} in trasferta
          </th>
        </tr>
        {row("Gol segnati", scored(ourVenue), scored(theirVenue), "venue-stat")}
        {row("Gol subiti", conceded(ourVenue), conceded(theirVenue), "venue-stat")}
        <tr className="group">
          <th colSpan={3} scope="colgroup">Precedenti</th>
        </tr>
        <tr>
          <th scope="row">Ultimi incontri</th>
          <td colSpan={2}>
            {h2h.length > 0 ? h2hSummary(club.name, h2h) : "nessun precedente"}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

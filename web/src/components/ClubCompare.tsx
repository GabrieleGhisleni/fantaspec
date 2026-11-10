import type { ReactNode } from "react";
import { num1, perGame } from "../format";
import { mirror } from "../screens/squadView";
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

/**
 * Club and opponent side by side: season numbers, then the venue of this match (the club's home games against
 * the opponent's away games, or the reverse), all per game.
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
        {row("Classifica", `${club.position}° · ${club.points} pt`, `${opponent.position}° · ${opponent.points} pt`)}
        {row("Forma", <FormPills results={club.form} />, <FormPills results={opponent.form} />)}
        {row("Gol fatti a partita", scored(club), scored(opponent))}
        {row("Gol subiti a partita", conceded(club), conceded(opponent))}
        <tr className="venue">
          <th colSpan={3} scope="colgroup">Solo per questa partita (in casa / in trasferta)</th>
        </tr>
        <tr>
          <td />
          <th scope="col">
            {club.name}
            <br />
            <span className="muted">{home ? "in casa" : "in trasferta"}</span>
          </th>
          <th scope="col">
            {opponent.name}
            <br />
            <span className="muted">{home ? "in trasferta" : "in casa"}</span>
          </th>
        </tr>
        {row("Gol fatti", scored(ourVenue), scored(theirVenue), "venue-stat")}
        {row("Gol subiti", conceded(ourVenue), conceded(theirVenue), "venue-stat")}
        {h2h.length > 0
          ? row("Precedenti", <FormPills results={h2h} />, <FormPills results={mirror(h2h)} />)
          : (
            <tr>
              <th scope="row">Precedenti</th>
              <td colSpan={2}>nessun precedente</td>
            </tr>
          )}
      </tbody>
    </table>
  );
}

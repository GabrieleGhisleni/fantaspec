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
  /** Squad players on each side, when the table sits in a match card. */
  players?: [string[], string[]];
};

const splitText = (s: Split) => `${s.gf}–${s.ga} in ${s.played}`;

/** Club and opponent side by side; the venue row uses the club's home and the opponent's away numbers, or the reverse. */
export function ClubCompare({ club, opponent, home, h2h, players }: Props) {
  const row = (label: string, ours: ReactNode, theirs: ReactNode) => (
    <tr>
      <th scope="row">{label}</th>
      <td>{ours}</td>
      <td>{theirs}</td>
    </tr>
  );
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
        {row("Gol fatti a partita", num1(perGame(club.gf, club.played)), num1(perGame(opponent.gf, opponent.played)))}
        {row("Gol subiti a partita", num1(perGame(club.ga, club.played)), num1(perGame(opponent.ga, opponent.played)))}
        {home
          ? row("In casa / In trasferta", splitText(club.home), splitText(opponent.away))
          : row("In trasferta / In casa", splitText(club.away), splitText(opponent.home))}
        {h2h.length > 0
          ? row("Precedenti", <FormPills results={h2h} />, <FormPills results={mirror(h2h)} />)
          : (
            <tr>
              <th scope="row">Precedenti</th>
              <td colSpan={2}>nessun precedente</td>
            </tr>
          )}
        {players && row("In rosa", players[0].join(", "), players[1].join(", "))}
      </tbody>
    </table>
  );
}

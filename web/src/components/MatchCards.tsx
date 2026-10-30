import { Fragment, useState } from "react";
import { kickoffTime } from "../format";
import { mirror, type Row } from "../screens/squadView";
import type { ClubData, Result } from "../types";
import { ClubCompare } from "./ClubCompare";

type Match = { key: string; kickoff: string; home: ClubData; away: ClubData; h2h: Result[] };

/** Each squad club's next match, once per pairing, soonest first. h2h is from the home side. */
function upcomingMatches(rows: Row[]): Match[] {
  const matches = new Map<string, Match>();
  for (const { club, opponent } of rows) {
    if (!club?.next || !opponent) continue;
    const { home: atHome, kickoff, h2h } = club.next;
    const [home, away] = atHome ? [club, opponent] : [opponent, club];
    const key = `${home.key}|${away.key}|${kickoff}`;
    if (!matches.has(key)) matches.set(key, { key, kickoff, home, away, h2h: atHome ? h2h : mirror(h2h) });
  }
  return [...matches.values()].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
}

/** A collapsed section with one card per upcoming match involving the squad. */
export function MatchCards({ rows }: { rows: Row[] }) {
  // The cards are only built once the section is opened.
  const [open, setOpen] = useState(false);
  const matches = upcomingMatches(rows);
  if (matches.length === 0) return null;

  // The squad's players in this match, one element per name so a line only ever breaks between names.
  const players = (club: ClubData) => {
    const names = rows.filter(r => r.club?.key === club.key).map(r => r.name);
    return names.length > 0 && (
      <p className="match-players" key={club.key}>
        <span className="muted">{club.name}</span>{" "}
        {names.map((name, i) => (
          <Fragment key={i}>
            {i > 0 && ", "}
            <span className="name">{name}</span>
          </Fragment>
        ))}
      </p>
    );
  };

  return (
    <details className="matches" onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>
        Partite della giornata <span className="muted">({matches.length})</span>
      </summary>
      {open && matches.map(m => (
        <article className="match-card" key={m.key}>
          <p className="match-title">
            <strong>{`${m.home.name} – ${m.away.name}`}</strong>
            <span className="muted">{kickoffTime(m.kickoff)}</span>
          </p>
          {players(m.home)}
          {players(m.away)}
          <ClubCompare club={m.home} opponent={m.away} home h2h={m.h2h} />
        </article>
      ))}
    </details>
  );
}

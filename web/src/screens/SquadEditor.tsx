import type { AppData } from "../types";
import type { Squad } from "../squads";

type Props = {
  data: AppData;
  squads: Squad[];
  onChange: (squads: Squad[]) => void;
};

// Placeholder until Task 10.
export function SquadEditor({ squads }: Props) {
  return (
    <>
      <h1>Le mie rose</h1>
      <ul>{squads.map(s => <li key={s.id}>{s.name}</li>)}</ul>
    </>
  );
}

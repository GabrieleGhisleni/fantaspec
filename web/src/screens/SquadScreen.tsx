import type { AppData } from "../types";
import type { Squad } from "../squads";

type Props = {
  data: AppData;
  squads: Squad[];
  selectedId: string;
  onSelect: (id: string) => void;
};

// Placeholder until Task 9.
export function SquadScreen({ squads, selectedId }: Props) {
  const squad = squads.find(s => s.id === selectedId) ?? squads[0];
  return <p>{squad.name} ({squad.players.length})</p>;
}

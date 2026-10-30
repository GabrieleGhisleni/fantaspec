import { decodeShare, type Squad } from "../squads";

type Props = {
  /** The `s` parameter of the share link. */
  param: string;
  squads: Squad[];
  onImport: (squad: Squad) => void;
};

// Placeholder until Task 10.
export function ImportScreen({ param }: Props) {
  return <p>{decodeShare(param) ? "Importa" : "Link non valido"}</p>;
}

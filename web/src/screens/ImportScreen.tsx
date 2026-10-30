import { useMemo } from "react";
import { playerCount } from "../format";
import { decodeShare, uniqueName, type Squad } from "../squads";

type Props = {
  /** The `s` parameter of the share link. */
  param: string;
  squads: Squad[];
  onImport: (squad: Squad) => void;
};

/** A shared squad: ask before adding it; a taken name gets a number. */
export function ImportScreen({ param, squads, onImport }: Props) {
  const squad = useMemo(() => decodeShare(param), [param]);
  if (!squad) return <p className="status" role="alert">Link non valido</p>;

  return (
    <section className="import">
      <h1 className="page-title">{`Importare «${squad.name}» (${playerCount(squad.players.length)})?`}</h1>
      {squad.players.length > 0 && <p className="muted">{squad.players.map(p => p.name).join(", ")}</p>}
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => onImport({ ...squad, name: uniqueName(squad.name, squads) })}>
          Importa
        </button>
        {/* replace: Back must not lead to this question again */}
        <button type="button" className="btn" onClick={() => window.location.replace("#/")}>Annulla</button>
      </div>
    </section>
  );
}

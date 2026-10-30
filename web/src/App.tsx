import { useEffect, useState, useSyncExternalStore } from "react";
import { loadData } from "./data";
import { defaultSquad } from "./defaultSquad";
import { ImportScreen } from "./screens/ImportScreen";
import { SquadEditor } from "./screens/SquadEditor";
import { SquadScreen } from "./screens/SquadScreen";
import { isNewBrowser, loadSelected, loadSquads, saveSelected, saveSquads, type Squad } from "./squads";
import type { AppData } from "./types";

type Route = { path: "/" | "/rose" | "/importa"; params: URLSearchParams };

function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const q = raw.indexOf("?");
  const path = q < 0 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q < 0 ? "" : raw.slice(q + 1));
  return { path: path === "/rose" || path === "/importa" ? path : "/", params };
}

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * The saved squads, decided once at startup. A browser that never saved any starts with the default squad,
 * saved and selected; an emptied list, corrupted or blocked storage stay empty. A new browser that arrives
 * through a share link is someone else's device: it saves an empty list instead, so neither the import nor
 * a cancelled import nor a later visit ever brings in the default squad.
 */
function initialSquads(path: Route["path"]): Squad[] {
  if (!isNewBrowser()) return loadSquads();
  if (path === "/importa") {
    saveSquads([]);
    return [];
  }
  const squad = defaultSquad();
  saveSquads([squad]);
  saveSelected(squad.id);
  return [squad];
}

type Load = { state: "loading" } | { state: "failed" } | { state: "ready"; data: AppData };

type Props = {
  /** Where the data comes from; tests pass their own. */
  load?: () => Promise<AppData>;
};

export default function App({ load = loadData }: Props) {
  const route = parseRoute(useSyncExternalStore(subscribeToHash, () => window.location.hash));
  // In this order: seeding the default squad also saves the selection read next.
  const [squads, setSquads] = useState(() => initialSquads(route.path));
  const [selected, setSelected] = useState(loadSelected);
  const [loaded, setLoaded] = useState<Load>({ state: "loading" });

  useEffect(() => {
    let current = true;
    load().then(
      data => current && setLoaded({ state: "ready", data }),
      () => current && setLoaded({ state: "failed" }),
    );
    return () => { current = false; };
  }, [load]);

  // First visit: with no squads, the home screen is the editor. An import link still works.
  const firstVisit = squads.length === 0 && route.path === "/";
  useEffect(() => {
    if (firstVisit) window.location.replace("#/rose");
  }, [firstVisit]);
  const path = firstVisit ? "/rose" : route.path;

  const selectedId = (squads.find(s => s.id === selected) ?? squads[0])?.id;

  function changeSquads(next: Squad[]) {
    setSquads(next);
    saveSquads(next);
  }
  function select(id: string) {
    setSelected(id);
    saveSelected(id);
  }
  function importSquad(squad: Squad) {
    changeSquads([...squads, squad]);
    select(squad.id);
    window.location.replace("#/"); // Back must not lead to the import question again
  }

  let screen;
  if (path === "/importa") {
    screen = <ImportScreen param={route.params.get("s") ?? ""} squads={squads} onImport={importSquad} />;
  } else if (loaded.state === "loading") {
    screen = <p className="status">Caricamento…</p>;
  } else if (loaded.state === "failed") {
    screen = <p className="status" role="alert">Dati non disponibili. Riprova più tardi.</p>;
  } else if (path === "/rose") {
    screen = (
      <>
        {squads.length === 0 && <p className="status">Crea la tua prima rosa</p>}
        <SquadEditor data={loaded.data} squads={squads} onChange={changeSquads} />
      </>
    );
  } else {
    screen = <SquadScreen data={loaded.data} squads={squads} selectedId={selectedId} onSelect={select} />;
  }

  return (
    <>
      <nav className="topbar">
        <a href="#/" className="brand">fantaspec</a>
        <a href="#/rose">Rose</a>
      </nav>
      <main>{screen}</main>
    </>
  );
}

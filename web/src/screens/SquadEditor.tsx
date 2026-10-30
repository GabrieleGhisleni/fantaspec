import { useId, useState } from "react";
import { playerCount } from "../format";
import { ROLE_ORDER } from "../search";
import { encodeShare, newId, type Squad } from "../squads";
import type { AppData, PlayerData, Role } from "../types";
import { PickButton, PlayerSearch } from "./PlayerSearch";

type Props = {
  data: AppData;
  squads: Squad[];
  onChange: (squads: Squad[]) => void;
};

const NAME_MAX = 50;

/** Role order, with players gone from the data last. */
const rank = (player: PlayerData | undefined) => (player ? ROLE_ORDER[player.role] : 4);

/** "Rosa 3": the first free number, counting on from the number of squads. */
function newName(squads: Squad[]): string {
  const taken = new Set(squads.map(s => s.name));
  let n = squads.length + 1;
  while (taken.has(`Rosa ${n}`)) n++;
  return `Rosa ${n}`;
}

/** Le mie rose: the list of squads (create, rename, delete) and, once one is opened, its editor. */
export function SquadEditor({ data, squads, onChange }: Props) {
  // A working copy, so the editor keeps up even when the parent does not hand the change back;
  // a new list from the parent replaces it.
  const [list, setList] = useState(squads);
  const [fromParent, setFromParent] = useState(squads);
  if (squads !== fromParent) {
    setFromParent(squads);
    setList(squads);
  }
  const [openId, setOpenId] = useState<string | null>(null);
  // At most one squad row shows the rename form or the delete question.
  const [pending, setPending] = useState<{ id: string; kind: "rename" | "delete" } | null>(null);

  function commit(next: Squad[]) {
    setList(next);
    onChange(next);
  }
  function update(squad: Squad) {
    commit(list.map(s => (s.id === squad.id ? squad : s)));
  }
  function create() {
    const squad: Squad = { id: newId(), name: newName(list), players: [] };
    commit([...list, squad]);
    setPending(null);
    setOpenId(squad.id);
  }

  const open = list.find(s => s.id === openId);
  if (open) {
    return <SquadForm key={open.id} data={data} squad={open} onChange={update} onBack={() => setOpenId(null)} />;
  }

  return (
    <section className="editor">
      <h1 className="page-title">Le mie rose</h1>
      <button type="button" className="btn primary wide" onClick={create}>Nuova rosa</button>
      <ul className="squad-list">
        {list.map(s => (
          <li key={s.id} className="squad-item">
            {pending?.id === s.id && pending.kind === "rename" ? (
              <NameForm
                name={s.name}
                onSave={name => { update({ ...s, name }); setPending(null); }}
                onCancel={() => setPending(null)}
              />
            ) : pending?.id === s.id ? (
              <>
                <p className="confirm">{`Eliminare «${s.name}»?`}</p>
                <div className="actions">
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => { commit(list.filter(x => x.id !== s.id)); setPending(null); }}
                  >
                    Elimina
                  </button>
                  <button type="button" className="btn" onClick={() => setPending(null)}>Annulla</button>
                </div>
              </>
            ) : (
              <>
                <button type="button" className="squad-open" onClick={() => { setPending(null); setOpenId(s.id); }}>
                  <span className="squad-name">{s.name}</span>
                  <span className="muted">{playerCount(s.players.length)}</span>
                </button>
                <div className="actions">
                  <button type="button" className="btn" onClick={() => setPending({ id: s.id, kind: "rename" })}>Rinomina</button>
                  <button type="button" className="btn" onClick={() => setPending({ id: s.id, kind: "delete" })}>Elimina</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

type NameFormProps = { name: string; onSave: (name: string) => void; onCancel: () => void };

/** Inline rename: the trimmed name, never empty. */
function NameForm({ name, onSave, onCancel }: NameFormProps) {
  const [value, setValue] = useState(name);
  const trimmed = value.trim();
  return (
    <form className="name-form" onSubmit={e => { e.preventDefault(); if (trimmed) onSave(trimmed); }}>
      <input
        className="field"
        aria-label="Nome della rosa"
        maxLength={NAME_MAX}
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
      />
      <div className="actions">
        <button type="submit" className="btn primary" disabled={!trimmed}>Salva</button>
        <button type="button" className="btn" onClick={onCancel}>Annulla</button>
      </div>
    </form>
  );
}

/** "copied", or the link to copy by hand when the clipboard refused it. */
type Shared = "copied" | { url: string } | null;

type FormProps = { data: AppData; squad: Squad; onChange: (squad: Squad) => void; onBack: () => void };

/** One open squad: search to add players, tap one in the squad to take him out, rename, share. */
function SquadForm({ data, squad, onChange, onBack }: FormProps) {
  const [renaming, setRenaming] = useState(false);
  const [shared, setShared] = useState<Shared>(null);
  const listId = useId();

  const ids = new Set(squad.players.map(p => p.id));
  const members = squad.players
    .map(({ id, name }) => {
      const player = data.players[String(id)] as PlayerData | undefined;
      return { id, player, name: player?.name ?? name };
    })
    .sort((a, b) => rank(a.player) - rank(b.player) || a.name.localeCompare(b.name, "it"));
  const counts = (Object.keys(ROLE_ORDER) as Role[])
    .map(role => `${role} ${members.filter(m => m.player?.role === role).length}`)
    .join(" · ");

  function change(next: Squad) {
    setShared(null); // a link shown before the change would share the old squad
    onChange(next);
  }
  function toggle(player: PlayerData) {
    change({
      ...squad,
      players: ids.has(player.id)
        ? squad.players.filter(p => p.id !== player.id)
        : [...squad.players, { id: player.id, name: player.name }],
    });
  }

  async function share() {
    const url = `${location.origin}${location.pathname}#/importa?s=${encodeShare(squad)}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: squad.name, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // closed by the user
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared("copied");
    } catch {
      setShared({ url });
    }
  }

  return (
    <section className="editor">
      <button type="button" className="back" onClick={onBack}><span aria-hidden="true">‹ </span>Le mie rose</button>
      {renaming ? (
        <NameForm
          name={squad.name}
          onSave={name => { change({ ...squad, name }); setRenaming(false); }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <>
          <h1 className="page-title">{squad.name}</h1>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setRenaming(true)}>Rinomina</button>
            <button type="button" className="btn" onClick={share}>Condividi</button>
          </div>
        </>
      )}
      {shared === "copied" && <p className="note" role="status">Link copiato</p>}
      {shared && shared !== "copied" && (
        <input readOnly className="field" aria-label="Link della rosa" value={shared.url} onFocus={e => e.currentTarget.select()} />
      )}
      <PlayerSearch data={data} picked={ids} onToggle={toggle} />
      <h2 id={listId} className="group-title">{`In rosa (${squad.players.length})`}</h2>
      <p className="counts">{counts}</p>
      <ul className="picks" aria-labelledby={listId}>
        {members.map(m => (
          <li key={m.id}>
            <PickButton
              data={data}
              player={m.player}
              name={m.name}
              mark="✕"
              label={`Togli ${m.name}`}
              onClick={() => change({ ...squad, players: squad.players.filter(p => p.id !== m.id) })}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

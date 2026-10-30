import { render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { Mock } from "vitest";
import { SquadEditor } from "./SquadEditor";
import { decodeShare, encodeShare, type Squad } from "../squads";
import type { AppData, PlayerData } from "../types";
import { fullSquad, sampleData, sampleSquad } from "../test/sampleData";

let user: UserEvent;
let onChange: Mock<(squads: Squad[]) => void>;
beforeEach(() => {
  user = userEvent.setup();
  onChange = vi.fn();
});

/** Every squad, as the editor last handed them back. */
const saved = (): Squad[] => onChange.mock.lastCall![0];
/** The last squad in that list (the only one when the editor started empty). */
const lastSaved = (): Squad => saved().at(-1)!;
/** The players of the open squad. */
const squadList = () => screen.getByRole("list", { name: /In rosa/ });
const results = () => screen.queryByRole("list", { name: "Risultati" });
/** Player names in a list, in the order shown. */
const names = (list: HTMLElement | null) => [...list!.querySelectorAll(".player-name")].map(e => e.textContent);
const shareUrl = (squad: Squad) => `${location.origin}${location.pathname}#/importa?s=${encodeShare(squad)}`;

async function openSquad(squads: Squad[], name: string, data: AppData = sampleData) {
  render(<SquadEditor data={data} squads={squads} onChange={onChange} />);
  await user.click(screen.getByText(name));
}

test("create a squad, add and remove players", async () => {
  render(<SquadEditor data={sampleData} squads={[]} onChange={onChange} />);
  await user.click(screen.getByText("Nuova rosa"));
  await user.type(screen.getByLabelText("Cerca giocatore"), "mer");
  await user.click(screen.getByText("Meret"));
  expect(lastSaved().players).toEqual([{ id: 572, name: "Meret" }]);
  await user.click(within(squadList()).getByText("Meret"));
  expect(lastSaved().players).toEqual([]);
});

test("search ignores accents and apostrophes", async () => {
  render(<SquadEditor data={sampleData} squads={[sampleSquad]} onChange={onChange} />);
  await user.click(screen.getByText(sampleSquad.name));
  await user.type(screen.getByLabelText("Cerca giocatore"), "ndicka");
  expect(screen.getByText("N'Dicka")).toBeInTheDocument();
});

// Beyond the brief.

test("lists the squads with their size", () => {
  render(<SquadEditor data={sampleData} squads={[sampleSquad, fullSquad]} onChange={onChange} />);
  expect(screen.getByRole("heading", { name: "Le mie rose" })).toBeInTheDocument();
  expect(screen.getByText(sampleSquad.name).closest("li")).toHaveTextContent("3 giocatori");
  expect(screen.getByText(fullSquad.name).closest("li")).toHaveTextContent("9 giocatori");
  expect(screen.queryByText("Crea la tua prima rosa")).not.toBeInTheDocument(); // App shows it, not the editor
});

test("a new squad gets the first free default name, a new id and opens right away", async () => {
  render(<SquadEditor data={sampleData} squads={[{ ...sampleSquad, name: "Rosa 2" }]} onChange={onChange} />);
  await user.click(screen.getByText("Nuova rosa"));
  expect(saved()).toEqual([{ ...sampleSquad, name: "Rosa 2" }, { id: expect.any(String), name: "Rosa 3", players: [] }]);
  expect(lastSaved().id).not.toBe(sampleSquad.id);
  expect(screen.getByRole("heading", { name: "Rosa 3" })).toBeInTheDocument();
  expect(screen.getByLabelText("Cerca giocatore")).toBeInTheDocument();
});

test("search needs two letters; the club select alone lists that club", async () => {
  await openSquad([sampleSquad], sampleSquad.name);
  await user.type(screen.getByLabelText("Cerca giocatore"), "n'");
  expect(results()).not.toBeInTheDocument();
  expect(screen.queryByText("Nessun giocatore")).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText("Cerca giocatore"));
  await user.selectOptions(screen.getByLabelText("Squadra"), "Roma");
  expect(names(results())).toEqual(["N'Dicka", "Panchinaro"]);
});

test("names that start with the search come first; role chips narrow the results", async () => {
  await openSquad([sampleSquad], sampleSquad.name);
  await user.type(screen.getByLabelText("Cerca giocatore"), "pa");
  expect(names(results())).toEqual(["Panchinaro", "Partito", "Senzapartita"]);
  expect(within(results()!).getByText("Partito").closest("button")).toHaveTextContent("non più in Serie A");
  await user.click(screen.getByRole("button", { name: "A" }));
  expect(names(results())).toEqual(["Partito"]);
  await user.click(screen.getByRole("button", { name: "D" }));
  expect(screen.getByText("Nessun giocatore")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Tutti" }));
  expect(names(results())).toHaveLength(3);
});

test("a result already in the squad is marked, and tapping it again removes it", async () => {
  await openSquad([sampleSquad], sampleSquad.name);
  await user.type(screen.getByLabelText("Cerca giocatore"), "mer");
  const meret = within(results()!).getByRole("button", { name: /Meret/ });
  expect(meret).toHaveAttribute("aria-pressed", "true");
  expect(meret).toHaveTextContent("Napoli");
  await user.click(meret);
  expect(lastSaved().players.map(p => p.id)).toEqual([184, 2097]);
  expect(within(results()!).getByRole("button", { name: /Meret/ })).toHaveAttribute("aria-pressed", "false");
});

test("long result lists show the first 50 and ask to refine", async () => {
  const many: PlayerData[] = Array.from({ length: 120 }, (_, i) => ({ ...sampleData.players["572"], id: 10000 + i, name: `Rossi ${i + 1}` }));
  const data: AppData = { ...sampleData, players: { ...sampleData.players, ...Object.fromEntries(many.map(p => [String(p.id), p])) } };
  await openSquad([sampleSquad], sampleSquad.name, data);
  await user.type(screen.getByLabelText("Cerca giocatore"), "rossi");
  expect(within(results()!).getAllByRole("button")).toHaveLength(50);
  expect(screen.getByText("Altri 70 giocatori: affina la ricerca")).toBeInTheDocument();
});

test("the squad shows its players by role with counts, keeps unknown ones and removes on tap", async () => {
  const squad: Squad = { id: "mix", name: "Mista", players: [{ id: 2097, name: "Kean" }, { id: 99999, name: "Sparito" }, { id: 572, name: "Meret" }] };
  await openSquad([squad], "Mista");
  expect(screen.getByRole("heading", { name: "In rosa (3)" })).toBeInTheDocument();
  expect(screen.getByText("P 1 · D 0 · C 0 · A 1")).toBeInTheDocument();
  expect(names(squadList())).toEqual(["Meret", "Kean", "Sparito"]);
  await user.click(within(squadList()).getByText("Sparito"));
  expect(lastSaved().players).toEqual([{ id: 2097, name: "Kean" }, { id: 572, name: "Meret" }]);
  expect(names(squadList())).toEqual(["Meret", "Kean"]);
});

test("Rinomina in the list renames with a trimmed, non-empty name", async () => {
  render(<SquadEditor data={sampleData} squads={[sampleSquad]} onChange={onChange} />);
  await user.click(screen.getByText("Rinomina"));
  const input = screen.getByLabelText("Nome della rosa");
  expect(input).toHaveValue(sampleSquad.name);
  await user.clear(input);
  await user.type(input, "   ");
  expect(screen.getByRole("button", { name: "Salva" })).toBeDisabled();
  await user.type(input, "Titolari  {Enter}");
  expect(saved()).toEqual([{ ...sampleSquad, name: "Titolari" }]);
  expect(screen.getByText("Titolari")).toBeInTheDocument();
});

test("Annulla leaves the name as it was", async () => {
  render(<SquadEditor data={sampleData} squads={[sampleSquad]} onChange={onChange} />);
  await user.click(screen.getByText("Rinomina"));
  await user.type(screen.getByLabelText("Nome della rosa"), "xyz");
  await user.click(screen.getByText("Annulla"));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByText(sampleSquad.name)).toBeInTheDocument();
});

test("the open squad can be renamed too", async () => {
  await openSquad([sampleSquad], sampleSquad.name);
  await user.click(screen.getByText("Rinomina"));
  const input = screen.getByLabelText("Nome della rosa");
  await user.clear(input);
  await user.type(input, "Titolari{Enter}");
  expect(lastSaved()).toEqual({ ...sampleSquad, name: "Titolari" });
  expect(screen.getByRole("heading", { name: "Titolari" })).toBeInTheDocument();
});

test("Elimina asks inside the page before deleting", async () => {
  render(<SquadEditor data={sampleData} squads={[sampleSquad, fullSquad]} onChange={onChange} />);
  const row = screen.getByText(sampleSquad.name).closest("li")!;
  await user.click(within(row).getByText("Elimina"));
  expect(within(row).getByText("Eliminare «FC Ghisleni»?")).toBeInTheDocument();
  await user.click(within(row).getByText("Annulla"));
  expect(onChange).not.toHaveBeenCalled();
  expect(within(row).getByText(sampleSquad.name)).toBeInTheDocument();
  await user.click(within(row).getByText("Elimina"));
  await user.click(within(row).getByRole("button", { name: "Elimina" }));
  expect(saved()).toEqual([fullSquad]);
  expect(screen.queryByText(sampleSquad.name)).not.toBeInTheDocument();
});

test("the back button returns to the list", async () => {
  await openSquad([sampleSquad], sampleSquad.name);
  await user.click(screen.getByRole("button", { name: "Le mie rose" }));
  expect(screen.getByRole("heading", { name: "Le mie rose" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Cerca giocatore")).not.toBeInTheDocument();
});

test("Condividi copies the import link and says so", async () => {
  await openSquad([sampleSquad], sampleSquad.name);
  await user.click(screen.getByText("Condividi"));
  expect(await screen.findByText("Link copiato")).toBeInTheDocument();
  const url = await navigator.clipboard.readText();
  expect(url).toBe(shareUrl(sampleSquad));
  expect(decodeShare(url.split("?s=")[1])).toEqual({ ...sampleSquad, id: expect.any(String) });
  await user.click(within(squadList()).getByText("Kean"));
  expect(screen.queryByText("Link copiato")).not.toBeInTheDocument(); // that link holds the old squad
});

describe("with the phone's share sheet", () => {
  let share: Mock<(data: ShareData) => Promise<void>>;
  beforeEach(() => {
    share = vi.fn();
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
  });
  afterEach(() => {
    delete (navigator as { share?: unknown }).share;
  });

  test("Condividi opens it with the import link", async () => {
    share.mockResolvedValue(undefined);
    await openSquad([sampleSquad], sampleSquad.name);
    await user.click(screen.getByText("Condividi"));
    expect(share).toHaveBeenCalledWith({ title: sampleSquad.name, url: shareUrl(sampleSquad) });
    expect(screen.queryByText("Link copiato")).not.toBeInTheDocument();
  });

  test("closing it copies nothing", async () => {
    share.mockRejectedValue(new DOMException("cancelled", "AbortError"));
    await openSquad([sampleSquad], sampleSquad.name);
    await user.click(screen.getByText("Condividi"));
    expect(screen.queryByText("Link copiato")).not.toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe("");
  });

  test("when it fails the link is copied instead", async () => {
    share.mockRejectedValue(new DOMException("not allowed", "NotAllowedError"));
    await openSquad([sampleSquad], sampleSquad.name);
    await user.click(screen.getByText("Condividi"));
    expect(await screen.findByText("Link copiato")).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(shareUrl(sampleSquad));
  });
});

test("when copying is not allowed the link is shown to copy by hand", async () => {
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
  await openSquad([sampleSquad], sampleSquad.name);
  await user.click(screen.getByText("Condividi"));
  expect(await screen.findByLabelText("Link della rosa")).toHaveValue(shareUrl(sampleSquad));
  expect(screen.queryByText("Link copiato")).not.toBeInTheDocument();
});

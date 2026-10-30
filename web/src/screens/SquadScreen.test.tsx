import { render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { SquadScreen } from "./SquadScreen";
import type { PlayerData } from "../types";
import { fullSquad, sampleData, sampleSquad } from "../test/sampleData";

const props = { data: sampleData, squads: [fullSquad], selectedId: fullSquad.id, onSelect: () => {} };

let user: UserEvent;
beforeEach(() => {
  user = userEvent.setup();
});

/** The list row of the player shown under `name`. */
const row = (name: string) => screen.getByText(name).closest("li")!;
/** Player names in the order the rows are shown. */
const rowNames = () => screen.getAllByRole("listitem").map(li => li.querySelector(".player-name")?.textContent);

test("groups by role with Italian headers", () => {
  render(<SquadScreen {...props} />);
  expect(screen.getAllByRole("heading").map(h => h.textContent)).toEqual(["Portieri", "Difensori", "Centrocampisti", "Attaccanti"]);
});

test("D chip + Sfida sort puts the defender facing the weakest attack first", async () => {
  render(<SquadScreen {...props} />);
  await user.click(screen.getByRole("button", { name: "D" }));
  await user.selectOptions(screen.getByLabelText("Ordina"), "Sfida");
  expect(rowNames()).toEqual(["Bastoni", "Dimarco", "Di Lorenzo"]); // per sampleData
});

test("tapping a row shows the club vs opponent comparison", async () => {
  render(<SquadScreen {...props} />);
  await user.click(screen.getByText("Meret"));
  expect(screen.getByText("Gol subiti a partita")).toBeInTheDocument();
  expect(screen.getByText("Gol sub.")).toBeInTheDocument();
});

test("never-voted and departed players render safely", () => {
  render(<SquadScreen {...props} />);
  expect(within(row("Panchinaro")).getByText("FV –")).toBeInTheDocument();
  expect(within(row("Partito")).getByText("non più in Serie A")).toBeInTheDocument();
});

test("failed last run shows the banner", () => {
  render(<SquadScreen {...props} data={{ ...sampleData, meta: { ...sampleData.meta, lastRun: { ...sampleData.meta.lastRun, ok: false } } }} />);
  expect(screen.getByText(/Ultimo aggiornamento non riuscito/)).toBeInTheDocument();
});

test("club with no next match", () => {
  render(<SquadScreen {...props} />);
  expect(within(row("Senzapartita")).getByText("nessuna partita")).toBeInTheDocument();
});

test("status tags and collapsed match cards", () => {
  render(<SquadScreen {...props} />);
  expect(within(row("Kean")).getByText("infortunato")).toBeInTheDocument();
  expect(screen.getByText(/Partite della giornata/).closest("details")).not.toHaveAttribute("open");
});

// Beyond the brief: the rest of the layout and the edge cases.

test("header shows the matchday and the update time in Rome time, no banner after a good run", () => {
  render(<SquadScreen {...props} />);
  expect(screen.getByText("Giornata 10 · 31 ott – 2 nov")).toBeInTheDocument();
  expect(screen.getByText("Aggiornato 31 ott 10:07")).toBeInTheDocument();
  expect(screen.queryByText(/Ultimo aggiornamento non riuscito/)).not.toBeInTheDocument();
});

test("the failed-run banner dates the data in Rome time", () => {
  const meta = { ...sampleData.meta, updatedAt: "2026-10-30T18:05:00Z", lastRun: { ...sampleData.meta.lastRun, ok: false } };
  render(<SquadScreen {...props} data={{ ...sampleData, meta }} />);
  expect(screen.getByText("Ultimo aggiornamento non riuscito: dati del 30 ott 19:05")).toBeInTheDocument();
});

test("the squad selector picks another squad", async () => {
  const onSelect = vi.fn();
  render(<SquadScreen {...props} squads={[fullSquad, sampleSquad]} onSelect={onSelect} />);
  await user.selectOptions(screen.getByLabelText("Rosa"), sampleSquad.name);
  expect(onSelect).toHaveBeenCalledWith(sampleSquad.id);
});

test("row lines: opponent with its position, start chance, median FV and matchup", () => {
  render(<SquadScreen {...props} />);
  const diLorenzo = within(row("Di Lorenzo"));
  expect(diLorenzo.getByText("@ Juventus 2°")).toBeInTheDocument();
  expect(diLorenzo.getByText("FV 6,8")).toBeInTheDocument();
  expect(diLorenzo.getByText("avv. segna 1,8")).toBeInTheDocument();
  expect(diLorenzo.getByText("90%")).toHaveClass("good");
  const kean = within(row("Kean"));
  expect(kean.getByText("vs Napoli 4°")).toBeInTheDocument();
  expect(kean.getByText("avv. subisce 1,1")).toBeInTheDocument();
  expect(kean.getByText("0%")).toHaveClass("bad");
});

test("the matchup is green when it helps the player and red when it hurts", () => {
  // Roma become the weakest attack (Bastoni's opponent), Inter the meanest defence (Panchinaro's opponent).
  const clubs = { ...sampleData.clubs, roma: { ...sampleData.clubs.roma, gf: 3 }, inter: { ...sampleData.clubs.inter, ga: 3 } };
  render(<SquadScreen {...props} data={{ ...sampleData, clubs }} />);
  expect(within(row("Bastoni")).getByText("avv. segna 0,3")).toHaveClass("good");
  expect(within(row("Panchinaro")).getByText("avv. subisce 0,3")).toHaveClass("bad");
});

test("role chips filter the rows", async () => {
  render(<SquadScreen {...props} />);
  await user.click(screen.getByRole("button", { name: "D" }));
  expect(rowNames()).toEqual(["Bastoni", "Di Lorenzo", "Dimarco"]);
  expect(screen.getAllByRole("heading").map(h => h.textContent)).toEqual(["Difensori"]);
  expect(screen.getByRole("button", { name: "D" })).toHaveAttribute("aria-pressed", "true");
  await user.click(screen.getByRole("button", { name: "Tutti" }));
  expect(rowNames()).toHaveLength(fullSquad.players.length);
});

test("Titolarità: highest start chance first, unknown last, one list without role headers", async () => {
  render(<SquadScreen {...props} />);
  await user.selectOptions(screen.getByLabelText("Ordina"), "Titolarità");
  expect(rowNames()).toEqual(["Meret", "Di Lorenzo", "Bastoni", "Bernardeschi", "Dimarco", "Panchinaro", "Kean", "Senzapartita", "Partito"]);
  expect(screen.queryAllByRole("heading")).toHaveLength(0);
});

test("FV mediana: highest median first, never voted last", async () => {
  render(<SquadScreen {...props} />);
  await user.click(screen.getByRole("button", { name: "C" }));
  await user.selectOptions(screen.getByLabelText("Ordina"), "FV mediana");
  expect(rowNames()).toEqual(["Bernardeschi", "Senzapartita", "Panchinaro"]);
});

test("Sfida across roles ranks each matchup against all clubs, no fixture last", async () => {
  render(<SquadScreen {...props} />);
  await user.selectOptions(screen.getByLabelText("Ordina"), "Sfida");
  // Roma's attack is weaker than 3 of 5 clubs; Napoli's defence leakier than 2; Juventus' attack weaker than 1
  // and Inter's defence leakier than 1. Ties keep the role order, then the name.
  expect(rowNames()).toEqual(["Bastoni", "Dimarco", "Bernardeschi", "Kean", "Meret", "Di Lorenzo", "Panchinaro", "Senzapartita", "Partito"]);
});

test("rows expand in place, several at once, and collapse on a second tap", async () => {
  render(<SquadScreen {...props} />);
  await user.click(screen.getByText("Meret"));
  await user.click(screen.getByText("Kean"));
  expect(within(row("Meret")).getByText("Gol sub.")).toBeInTheDocument();
  expect(within(row("Kean")).getByText("rientro da metà novembre")).toBeInTheDocument();
  await user.click(screen.getByText("Meret"));
  expect(within(row("Meret")).queryByText("Gol sub.")).not.toBeInTheDocument();
  expect(within(row("Kean")).getByText("Gol")).toBeInTheDocument();
});

test("the detail shows season, last 5 and the club vs opponent numbers", async () => {
  render(<SquadScreen {...props} />);
  await user.click(screen.getByText("Meret"));
  const detail = within(row("Meret"));
  expect(detail.getByText("−10")).toHaveClass("bad"); // a keeper's goals conceded: negative and red
  expect(detail.getByText("5/5")).toBeInTheDocument();
  expect(detail.getByText("5,0 6,0 7,0 4,0 6,0")).toBeInTheDocument();
  expect(detail.getByText("4° · 17 pt")).toBeInTheDocument();
  expect(detail.getByText("2° · 20 pt")).toBeInTheDocument();
  expect(detail.getByText("1,6")).toBeInTheDocument(); // Napoli scored 14 in 9
  expect(detail.getByText("In trasferta / In casa")).toBeInTheDocument();
  expect(detail.getByText("6–7 in 4")).toBeInTheDocument(); // Napoli away
  expect(detail.getByText("10–2 in 5")).toBeInTheDocument(); // Juventus at home
});

test("a never-voted player's detail shows dashes and an empty trend", async () => {
  render(<SquadScreen {...props} />);
  await user.click(screen.getByText("Panchinaro"));
  const detail = within(row("Panchinaro"));
  expect(detail.getByText("0/5")).toBeInTheDocument();
  expect(detail.getByText("– – – – –")).toBeInTheDocument();
});

test("a departed player's detail keeps his season numbers, with no club comparison", async () => {
  render(<SquadScreen {...props} />);
  await user.click(screen.getByText("Partito"));
  const detail = within(row("Partito"));
  expect(detail.getByText("Med FV")).toBeInTheDocument();
  expect(detail.getByText("6,1")).toBeInTheDocument();
  expect(detail.queryByText("Classifica")).not.toBeInTheDocument();
  expect(detail.queryByText("0/0")).not.toBeInTheDocument();
});

test("a squad player missing from the data keeps the stored name", () => {
  const squad = { ...fullSquad, players: [...fullSquad.players, { id: 123456, name: "Sparito" }] };
  render(<SquadScreen {...props} squads={[squad]} selectedId={squad.id} />);
  expect(within(row("Sparito")).getByText("non più in Serie A")).toBeInTheDocument();
  expect(screen.getAllByRole("heading")).toHaveLength(4);
});

test("a player whose data breaks the row shows a fallback line and the rest still renders", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const broken = { ...sampleData.players["572"], season: null } as unknown as PlayerData;
  render(<SquadScreen {...props} data={{ ...sampleData, players: { ...sampleData.players, 572: broken } }} />);
  expect(within(row("Meret")).getByText("dati non disponibili")).toBeInTheDocument();
  expect(within(row("Kean")).getByText("infortunato")).toBeInTheDocument();
});

test("match cards: one per upcoming match of the squad's clubs, with the squad players involved", async () => {
  render(<SquadScreen {...props} />);
  await user.click(screen.getByText(/Partite della giornata/));
  const cards = await screen.findAllByRole("article");
  expect(cards).toHaveLength(2);
  const first = within(cards[0]);
  expect(first.getByText("Juventus – Napoli")).toBeInTheDocument();
  expect(first.getByText("sab 31 ott 18:00")).toBeInTheDocument();
  expect(first.getByText("Bernardeschi, Kean")).toBeInTheDocument();
  expect(first.getByText("Meret, Di Lorenzo")).toBeInTheDocument();
  expect(within(cards[1]).getByText("Inter – Roma")).toBeInTheDocument();
});

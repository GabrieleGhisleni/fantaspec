import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { Mock } from "vitest";
import { ImportScreen } from "./ImportScreen";
import { encodeShare, type Squad } from "../squads";
import { sampleSquad } from "../test/sampleData";

let user: UserEvent;
let onImport: Mock<(squad: Squad) => void>;
beforeEach(() => {
  user = userEvent.setup();
  onImport = vi.fn();
});

test("import a valid link", async () => {
  render(<ImportScreen param={encodeShare(sampleSquad)} squads={[]} onImport={onImport} />);
  await user.click(screen.getByText("Importa"));
  expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ name: sampleSquad.name, players: sampleSquad.players }));
});

test("invalid link", () => {
  render(<ImportScreen param="garbage" squads={[]} onImport={onImport} />);
  expect(screen.getByText("Link non valido")).toBeInTheDocument();
});

// Beyond the brief.

test("asks first, with the squad's name, size and players", () => {
  render(<ImportScreen param={encodeShare(sampleSquad)} squads={[]} onImport={onImport} />);
  expect(screen.getByText("Importare «FC Ghisleni» (3 giocatori)?")).toBeInTheDocument();
  expect(screen.getByText("Meret, Bernardeschi, Kean")).toBeInTheDocument();
  expect(onImport).not.toHaveBeenCalled();
});

test("one player is singular", () => {
  render(<ImportScreen param={encodeShare({ ...sampleSquad, players: [{ id: 572, name: "Meret" }] })} squads={[]} onImport={onImport} />);
  expect(screen.getByText("Importare «FC Ghisleni» (1 giocatore)?")).toBeInTheDocument();
});

test("the imported squad gets a new id, and a numbered name when the name is taken", async () => {
  const taken = [sampleSquad, { ...sampleSquad, id: "other", name: "FC Ghisleni (2)" }];
  render(<ImportScreen param={encodeShare(sampleSquad)} squads={taken} onImport={onImport} />);
  await user.click(screen.getByText("Importa"));
  const imported = onImport.mock.lastCall![0];
  expect(imported).toEqual({ id: expect.any(String), name: "FC Ghisleni (3)", players: sampleSquad.players });
  expect(taken.map(s => s.id)).not.toContain(imported.id);
});

test("Annulla goes home without importing or leaving a history entry", async () => {
  window.location.hash = `#/importa?s=${encodeShare(sampleSquad)}`;
  const before = history.length;
  render(<ImportScreen param={encodeShare(sampleSquad)} squads={[]} onImport={onImport} />);
  await user.click(screen.getByText("Annulla"));
  expect(window.location.hash).toBe("#/");
  expect(history.length).toBe(before);
  expect(onImport).not.toHaveBeenCalled();
});

test("a missing or tampered link is not valid", () => {
  for (const param of ["", encodeShare({ ...sampleSquad, name: "   " })]) {
    const { unmount } = render(<ImportScreen param={param} squads={[]} onImport={onImport} />);
    expect(screen.getByText("Link non valido")).toBeInTheDocument();
    expect(screen.queryByText("Importa")).not.toBeInTheDocument();
    unmount();
  }
});

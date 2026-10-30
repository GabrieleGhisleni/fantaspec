import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import type { AppData } from "./types";
import { encodeShare, loadSelected, loadSquads, saveSelected, saveSquads, type Squad } from "./squads";
import { fullSquad, sampleData, sampleSquad } from "./test/sampleData";

function renderApp({ data, squads, load }: { data?: AppData; squads: Squad[]; load?: () => Promise<AppData> }) {
  saveSquads(squads);
  return render(<App load={load ?? (() => Promise.resolve(data!))} />);
}

test("no squads sends the user to the editor", async () => {
  renderApp({ data: sampleData, squads: [] });
  expect(await screen.findByText("Crea la tua prima rosa")).toBeInTheDocument();
  expect(window.location.hash).toBe("#/rose");
});

// These tests only rely on the squad name, the squad selector and the editor title.
const squadName = new RegExp(sampleSquad.name);

test("with squads the home route shows the squad screen", async () => {
  renderApp({ data: sampleData, squads: [sampleSquad] });
  expect(await screen.findAllByText(squadName)).not.toHaveLength(0);
  expect(screen.queryByText("Crea la tua prima rosa")).not.toBeInTheDocument();
  expect(screen.queryByText("Le mie rose")).not.toBeInTheDocument();
  expect(window.location.hash).toBe("");
});

test("an unknown selected squad falls back to the first one", async () => {
  saveSelected("gone");
  renderApp({ data: sampleData, squads: [sampleSquad, fullSquad] });
  expect(await screen.findByLabelText("Rosa")).toHaveDisplayValue(sampleSquad.name);
  expect(screen.queryByText("Bastoni")).not.toBeInTheDocument(); // only in the second squad
});

test("the hash switches between the screens", async () => {
  window.location.hash = "#/rose";
  renderApp({ data: sampleData, squads: [sampleSquad] });
  expect(await screen.findAllByText("Le mie rose")).not.toHaveLength(0);
  expect(screen.queryByText("Crea la tua prima rosa")).not.toBeInTheDocument();
  window.location.hash = "#/";
  await waitFor(() => expect(screen.queryByText("Le mie rose")).not.toBeInTheDocument());
  expect(screen.getAllByText(squadName)).not.toHaveLength(0);
});

test("an import link works on a first visit with no squads", async () => {
  window.location.hash = "#/importa?s=garbage";
  renderApp({ data: sampleData, squads: [] });
  expect(await screen.findByText("Link non valido")).toBeInTheDocument();
  expect(window.location.hash).toBe("#/importa?s=garbage");
});

test("data that cannot be loaded shows a message instead of a blank page", async () => {
  renderApp({ squads: [sampleSquad], load: () => Promise.reject(new Error("offline")) });
  expect(await screen.findByText("Dati non disponibili. Riprova più tardi.")).toBeInTheDocument();
});

test("corrupted stored squads start the app with the first-visit editor", async () => {
  localStorage.setItem("fantaspec.squads.v1", "{broken");
  render(<App load={() => Promise.resolve(sampleData)} />);
  expect(await screen.findByText("Crea la tua prima rosa")).toBeInTheDocument();
  expect(localStorage.getItem("fantaspec.squads.v1")).toBe("{broken"); // no default squad written over it
});

test("importing a link adds the squad, selects and saves it, and goes home without a history entry", async () => {
  const user = userEvent.setup();
  saveSelected(fullSquad.id);
  window.location.hash = `#/importa?s=${encodeShare(sampleSquad)}`;
  renderApp({ data: sampleData, squads: [fullSquad] });
  const before = history.length;
  await user.click(await screen.findByText("Importa"));
  expect(window.location.hash).toBe("#/");
  expect(history.length).toBe(before);
  expect(await screen.findByLabelText("Rosa")).toHaveDisplayValue(sampleSquad.name);
  const stored = loadSquads();
  expect(stored).toEqual([fullSquad, { ...sampleSquad, id: expect.any(String) }]);
  expect(stored[1].id).not.toBe(sampleSquad.id);
  expect(loadSelected()).toBe(stored[1].id);
});

test("squads created and edited in the editor are saved", async () => {
  const user = userEvent.setup();
  renderApp({ data: sampleData, squads: [] });
  await user.click(await screen.findByText("Nuova rosa"));
  await user.type(screen.getByLabelText("Cerca giocatore"), "mer");
  await user.click(screen.getByText("Meret"));
  await user.click(screen.getByText("Rinomina"));
  const name = screen.getByLabelText("Nome della rosa");
  await user.clear(name);
  await user.type(name, "Titolari{Enter}");
  expect(loadSquads()).toEqual([{ id: expect.any(String), name: "Titolari", players: [{ id: 572, name: "Meret" }] }]);
  window.location.hash = "#/";
  expect(await screen.findByLabelText("Rosa")).toHaveDisplayValue("Titolari");
});

// The default squad: only a browser that never saved squads gets it.

test("a first visit starts with the default squad, saved and selected", async () => {
  render(<App load={() => Promise.resolve(sampleData)} />);
  expect(await screen.findByLabelText("Rosa")).toHaveDisplayValue("La mia rosa");
  expect(window.location.hash).toBe("");
  const stored = loadSquads();
  expect(stored).toEqual([{ id: expect.any(String), name: "La mia rosa", players: expect.any(Array) }]);
  expect(stored[0].players).toHaveLength(29);
  expect(loadSelected()).toBe(stored[0].id);
});

test("a saved empty list stays empty: no default squad after deleting everything", async () => {
  localStorage.setItem("fantaspec.squads.v1", "[]");
  render(<App load={() => Promise.resolve(sampleData)} />);
  expect(await screen.findByText("Crea la tua prima rosa")).toBeInTheDocument();
  expect(localStorage.getItem("fantaspec.squads.v1")).toBe("[]");
});

test("blocked storage gets no default squad", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  render(<App load={() => Promise.resolve(sampleData)} />);
  expect(await screen.findByText("Crea la tua prima rosa")).toBeInTheDocument();
});

// A share link opened in a new browser is a friend's device: never the default squad there, now or later.

test("a first visit through a share link imports only that squad", async () => {
  const user = userEvent.setup();
  window.location.hash = `#/importa?s=${encodeShare(sampleSquad)}`;
  render(<App load={() => Promise.resolve(sampleData)} />);
  await user.click(await screen.findByText("Importa"));
  expect(await screen.findByLabelText("Rosa")).toHaveDisplayValue(sampleSquad.name);
  expect(loadSquads()).toEqual([{ ...sampleSquad, id: expect.any(String) }]);
  expect(screen.queryByText("La mia rosa")).not.toBeInTheDocument();
});

test("a first visit through a share link that is cancelled gets no default squad, then or on the next visit", async () => {
  const user = userEvent.setup();
  window.location.hash = `#/importa?s=${encodeShare(sampleSquad)}`;
  const { unmount } = render(<App load={() => Promise.resolve(sampleData)} />);
  await user.click(await screen.findByText("Annulla"));
  expect(await screen.findByText("Crea la tua prima rosa")).toBeInTheDocument();
  expect(window.location.hash).toBe("#/rose");
  expect(loadSquads()).toEqual([]);
  unmount();
  window.location.hash = "#/";
  render(<App load={() => Promise.resolve(sampleData)} />);
  expect(await screen.findByText("Crea la tua prima rosa")).toBeInTheDocument();
  expect(screen.queryByText("La mia rosa")).not.toBeInTheDocument();
});

import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import type { AppData } from "./types";
import { saveSelected, saveSquads, type Squad } from "./squads";
import { sampleData, sampleSquad } from "./test/sampleData";

function renderApp({ data, squads, load }: { data?: AppData; squads: Squad[]; load?: () => Promise<AppData> }) {
  saveSquads(squads);
  return render(<App load={load ?? (() => Promise.resolve(data!))} />);
}

test("no squads sends the user to the editor", async () => {
  renderApp({ data: sampleData, squads: [] });
  expect(await screen.findByText("Crea la tua prima rosa")).toBeInTheDocument();
  expect(window.location.hash).toBe("#/rose");
});

// Screens 9 and 10 will replace the placeholders, so these tests only rely on the squad name and the editor title.
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
  renderApp({ data: sampleData, squads: [sampleSquad] });
  expect(await screen.findAllByText(squadName)).not.toHaveLength(0);
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
});

import { normalize, searchPlayers, type Filters } from "./search";
import { sampleData } from "./test/sampleData";

const all = Object.values(sampleData.players);
const find = (filters: Partial<Filters>) =>
  searchPlayers(all, { query: "", role: null, club: "", ...filters })?.map(p => p.name) ?? null;

test("normalize keeps only lower-case letters and digits, without accents", () => {
  expect(normalize("N'Dicka")).toBe("ndicka");
  expect(normalize("N’Dicka")).toBe("ndicka");
  expect(normalize("Montipò")).toBe("montipo");
  expect(normalize("Milinković-Savić V.")).toBe("milinkovicsavicv");
  expect(normalize("Da Cunha")).toBe("dacunha");
});

test("nothing is searched below two letters unless a club is picked", () => {
  expect(find({})).toBeNull();
  expect(find({ query: "m" })).toBeNull();
  expect(find({ query: "n'" })).toBeNull();
  expect(find({ role: "D" })).toBeNull();
  expect(find({ club: "roma" })).toEqual(["N'Dicka", "Panchinaro"]);
});

test("matches anywhere in the name, ignoring accents, apostrophes and case", () => {
  expect(find({ query: "NDÌCKA" })).toEqual(["N'Dicka"]);
  expect(find({ query: "di lo" })).toEqual(["Di Lorenzo"]);
});

test("names that start with the search come first, then by role and name", () => {
  expect(find({ query: "pa" })).toEqual(["Panchinaro", "Partito", "Senzapartita"]);
  expect(find({ club: "inter" })).toEqual(["Bastoni", "Dimarco"]);
});

test("role and club narrow the search", () => {
  expect(find({ query: "pa", role: "A" })).toEqual(["Partito"]);
  expect(find({ query: "di", club: "inter" })).toEqual(["Dimarco"]);
  expect(find({ query: "pa", role: "P" })).toEqual([]);
});

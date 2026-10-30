import type { AppData, ClubData, Meta, PlayerData } from "./types";

async function getJson<T>(name: string): Promise<T> {
  // no-cache: always revalidate, so a phone never keeps showing yesterday's numbers.
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${name}.json: HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function loadData(): Promise<AppData> {
  const [meta, clubs, players] = await Promise.all([
    getJson<Meta>("meta"),
    getJson<Record<string, ClubData>>("clubs"),
    getJson<Record<string, PlayerData>>("players"),
  ]);
  return { meta, clubs, players };
}

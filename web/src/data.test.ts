import { loadData } from "./data";
import { sampleData } from "./test/sampleData";

function stubFetch(respond: (url: string) => Response) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => Promise.resolve(respond(url)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("loads the three data files from the site base, bypassing stale caches", async () => {
  vi.stubEnv("BASE_URL", "/fantaspec/");
  const files: Record<string, unknown> = { meta: sampleData.meta, clubs: sampleData.clubs, players: sampleData.players };
  const fetchMock = stubFetch(url => Response.json(files[url.split("/").pop()!.replace(".json", "")]));
  expect(await loadData()).toEqual(sampleData);
  expect(fetchMock.mock.calls.map(c => c[0]).sort()).toEqual(
    ["/fantaspec/data/clubs.json", "/fantaspec/data/meta.json", "/fantaspec/data/players.json"],
  );
  for (const call of fetchMock.mock.calls) expect(call[1]).toEqual({ cache: "no-cache" });
});

test("a failed request rejects", async () => {
  stubFetch(() => new Response("nope", { status: 404 }));
  await expect(loadData()).rejects.toThrow(/404/);
});

import "@testing-library/jest-dom/vitest";

// Vitest's jsdom environment exposes the JSDOM instance as a global.
declare const jsdom: { window: { localStorage: Storage } };

// Node 25+ has its own global `localStorage` (a stub that warns and is undefined without --localstorage-file),
// which hides the jsdom one. Point it back at jsdom's so tests behave like a browser on any Node version.
Object.defineProperty(globalThis, "localStorage", { value: jsdom.window.localStorage, configurable: true, writable: true });

// Every test starts from clean storage, an empty URL hash and no leftover spies.
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

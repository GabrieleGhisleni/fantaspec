import "@testing-library/jest-dom/vitest";

// Every test starts from clean storage, an empty URL hash and no leftover spies.
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

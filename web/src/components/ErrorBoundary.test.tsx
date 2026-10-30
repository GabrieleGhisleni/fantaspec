import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Broken(): never {
  throw new Error("bad data");
}

test("a child that throws while rendering is replaced by the fallback", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <ul>
      <ErrorBoundary fallback={<li>Meret: dati non disponibili</li>}><Broken /></ErrorBoundary>
      <ErrorBoundary fallback={<li>Kean: dati non disponibili</li>}><li>Kean</li></ErrorBoundary>
    </ul>,
  );
  expect(screen.getByText("Meret: dati non disponibili")).toBeInTheDocument();
  expect(screen.getByText("Kean")).toBeInTheDocument();
  expect(screen.queryByText("Kean: dati non disponibili")).not.toBeInTheDocument();
});

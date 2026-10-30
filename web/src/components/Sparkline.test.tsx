import { render } from "@testing-library/react";
import { Sparkline } from "./Sparkline";

test("a 60x16 chart with one line per run of votes and a dot for a lone vote", () => {
  const { container } = render(<Sparkline values={[6.5, 7, null, 6, null]} />);
  const svg = container.querySelector("svg")!;
  expect(svg).toHaveAttribute("width", "60");
  expect(svg).toHaveAttribute("height", "16");
  expect(svg.querySelectorAll("polyline")).toHaveLength(1);
  expect(svg.querySelector("polyline")!.getAttribute("points")!.split(" ")).toHaveLength(2);
  expect(svg.querySelectorAll("circle")).toHaveLength(1);
});

test("missing votes leave a gap instead of joining across it", () => {
  const { container } = render(<Sparkline values={[6, 7, null, 6, 8]} />);
  expect(container.querySelectorAll("polyline")).toHaveLength(2);
});

test("no votes draw nothing", () => {
  const { container } = render(<Sparkline values={[null, null, null]} />);
  expect(container.querySelectorAll("polyline, circle")).toHaveLength(0);
});

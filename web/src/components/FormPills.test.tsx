import { render, screen } from "@testing-library/react";
import { FormPills } from "./FormPills";

test("results read as Italian letters, oldest first, coloured by outcome", () => {
  render(<FormPills results={["W", "D", "L"]} />);
  const pills = screen.getAllByText(/^[VNP]$/);
  expect(pills.map(p => p.textContent)).toEqual(["V", "N", "P"]);
  expect(pills[0]).toHaveClass("good");
  expect(pills[2]).toHaveClass("bad");
});

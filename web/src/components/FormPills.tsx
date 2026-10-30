import type { Result } from "../types";

const LETTER: Record<Result, string> = { W: "V", D: "N", L: "P" };
const TONE: Record<Result, string> = { W: "good", D: "", L: "bad" };

/** Results as small squares, oldest first, in Italian: V vinta, N pareggiata, P persa. */
export function FormPills({ results }: { results: Result[] }) {
  return (
    <span className="pills">
      {results.map((r, i) => <span key={i} className={`pill ${TONE[r]}`}>{LETTER[r]}</span>)}
    </span>
  );
}

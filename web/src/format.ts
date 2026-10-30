const oneDecimal = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dayMonth = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });

/** One decimal, Italian style: 6,5. A missing number shows as an en dash. */
export function num1(n: number | null): string {
  return n === null ? "–" : oneDecimal.format(n);
}

/** Average per game; 0 for a club that has not played yet. */
export function perGame(total: number, played: number): number {
  return played > 0 ? total / played : 0;
}

/**
 * Colours a value against all clubs: the top third of `all` is "good" when higher is good (the bottom third
 * when it is not), the opposite third is "bad", the middle stays neutral. Ties and flat lists stay neutral.
 */
export function tertile(value: number, all: number[], higherIsGood: boolean): "good" | "bad" | "" {
  const third = Math.floor(all.length / 3);
  if (third === 0) return "";
  const sorted = [...all].sort((x, y) => x - y);
  const isLow = value <= sorted[third - 1];
  const isHigh = value >= sorted[sorted.length - third];
  if (isLow === isHigh) return "";
  return isLow === higherIsGood ? "bad" : "good";
}

/** Probable-lineup percentage: 75 and above is good, below 50 is bad. */
export function startClass(pct: number | null): "good" | "bad" | "" {
  if (pct === null) return "";
  return pct >= 75 ? "good" : pct < 50 ? "bad" : "";
}

/** "2026-10-31", "2026-11-02" -> "31 ott – 2 nov". */
export function dateRange(from: string, to: string): string {
  const day = (iso: string) => dayMonth.format(new Date(`${iso}T00:00:00Z`));
  return from === to ? day(from) : `${day(from)} – ${day(to)}`;
}

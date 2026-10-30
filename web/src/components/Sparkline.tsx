const WIDTH = 60;
const HEIGHT = 16;
const PAD = 2;

/** Fantavote trend over the club's last matches: a line per run of votes, a dot for a lone one, gaps where none. */
export function Sparkline({ values }: { values: (number | null)[] }) {
  const present = values.filter((v): v is number => v !== null);
  const min = Math.min(...present);
  const span = Math.max(...present) - min;
  const x = (i: number) => (values.length > 1 ? PAD + (i * (WIDTH - 2 * PAD)) / (values.length - 1) : WIDTH / 2);
  const y = (v: number) => (span > 0 ? HEIGHT - PAD - ((v - min) * (HEIGHT - 2 * PAD)) / span : HEIGHT / 2);

  // Split into runs of consecutive votes.
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push([x(i), y(v)]);
    }
  });
  if (run.length) runs.push(run);

  return (
    <svg className="sparkline" width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
      {runs.map((points, i) =>
        points.length === 1
          ? <circle key={i} cx={points[0][0]} cy={points[0][1]} r={1.5} />
          : <polyline key={i} points={points.map(([px, py]) => `${px},${py}`).join(" ")} />,
      )}
    </svg>
  );
}

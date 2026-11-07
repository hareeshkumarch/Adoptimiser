interface Props {
  values: (number | null)[];
  width?: number;
  height?: number;
  stroke?: string;
}

export const Sparkline = ({ values, width = 112, height = 28, stroke = "var(--slate-12)" }: Props) => {
  const points = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null && Number.isFinite(p[1]));
  if (points.length < 2) return <svg width={width} height={height} />;
  const ys = points.map((p) => p[1]);
  const min = Math.min(...ys);
  const span = Math.max(...ys) - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const d = points.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const [li, lv] = points[points.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" />
      <circle cx={x(li)} cy={y(lv)} r={2} fill={stroke} />
    </svg>
  );
};

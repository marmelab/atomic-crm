type TrendPoint = {
  label: string;
  value: number | null;
};

export function VisibilityTrendChart({
  points,
  label,
}: {
  points: TrendPoint[];
  label: string;
}) {
  const available = points.filter(
    (point): point is TrendPoint & { value: number } =>
      typeof point.value === "number",
  );
  if (available.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Minst två officiella månadsperioder behövs för en trendgraf.
      </p>
    );
  }
  const width = 640;
  const height = 180;
  const padding = 24;
  const values = available.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coordinates = available.map((point, index) => ({
    ...point,
    x:
      padding +
      (index / Math.max(available.length - 1, 1)) * (width - padding * 2),
    y:
      height - padding - ((point.value - min) / range) * (height - padding * 2),
  }));
  const path = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height + 28}`}
        className="min-w-[560px] w-full"
        role="img"
        aria-label={`${label} över tid`}
      >
        <path
          d={path}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coordinates.map((point) => (
          <g key={`${point.label}-${point.x}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="var(--color-primary)"
            />
            <text
              x={point.x}
              y={height + 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

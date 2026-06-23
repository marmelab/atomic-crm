/**
 * Shared chart styling for the dashboard so every Nivo chart looks cohesive,
 * calm and professional. Colors reference the CSS design tokens (see index.css)
 * so charts automatically adapt to light/dark mode.
 */

/** Nivo theme using design tokens. Passed to every chart's `theme` prop. */
export const NIVO_THEME = {
  text: {
    fontFamily: "inherit",
    fontSize: 11,
    fill: "var(--color-muted-foreground)",
  },
  axis: {
    domain: { line: { stroke: "transparent" } },
    ticks: {
      line: { stroke: "transparent" },
      text: { fill: "var(--color-muted-foreground)", fontSize: 11 },
    },
    legend: { text: { fill: "var(--color-muted-foreground)", fontSize: 12 } },
  },
  grid: {
    line: {
      stroke: "var(--color-border)",
      strokeWidth: 1,
      strokeDasharray: "3 3",
    },
  },
  legends: { text: { fill: "var(--color-muted-foreground)", fontSize: 12 } },
  tooltip: {
    container: { background: "transparent", boxShadow: "none", padding: 0 },
  },
} as const;

/**
 * Cohesive categorical palette for distribution charts (donut, stacked).
 * Distinct hues but all from the harmonized chart tokens.
 */
export const CHART_PALETTE = [
  "var(--color-chart-1)", // brand blue
  "var(--color-chart-4)", // violet
  "var(--color-chart-3)", // amber
  "var(--color-chart-5)", // cyan
  "var(--color-chart-2)", // green
];

const DEFAULT_LOCALE = "en-US";

export const resolveLocale = () =>
  navigator?.languages?.[0] ?? navigator?.language ?? DEFAULT_LOCALE;

/** Full currency formatting, e.g. "1 234 kr". */
export function formatCurrency(
  value: number,
  currency: string,
  locale: string = resolveLocale(),
): string {
  return value.toLocaleString(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

/** Compact currency for big numbers, e.g. "1,5 mn kr" / "355 tn kr". */
export function formatCompactCurrency(
  value: number,
  currency: string,
  locale: string = resolveLocale(),
): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 1,
    })}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    })}k`;
  }
  return formatCurrency(value, currency, locale);
}

/** Short numeric axis ticks without currency symbol, e.g. "355k", "1.2M". */
export function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${value}`;
}

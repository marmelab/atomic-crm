const DIVISIONS: Array<{
  amount: number;
  unit: Intl.RelativeTimeFormatUnit;
}> = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export const formatRelativeTime = (
  value: string | Date,
  locale = "en",
  now = new Date(),
) => {
  const date = value instanceof Date ? value : new Date(value);
  const diffInSeconds = (date.getTime() - now.getTime()) / 1000;

  const formatter = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
  });

  let duration = diffInSeconds;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return formatter.format(Math.round(duration), "year");
};

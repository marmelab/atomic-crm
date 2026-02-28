import { differenceInDays, formatRelative } from "date-fns";
import { pl } from "date-fns/locale";

export function RelativeDate({ date }: { date: string }) {
  const dateObj = new Date(date);
  const now = new Date();

  if (differenceInDays(now, dateObj) > 6) {
    return dateObj.toLocaleDateString("pl-PL");
  }

  return formatRelative(dateObj, now, { locale: pl });
}

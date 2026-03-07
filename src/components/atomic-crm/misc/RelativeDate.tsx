import { differenceInDays, formatRelative } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { useLocaleState } from "ra-core";

export function RelativeDate({ date }: { date: string }) {
  const [locale = "en"] = useLocaleState();
  const dateObj = new Date(date);
  const now = new Date();
  const dateFnsLocale = locale.startsWith("fr") ? fr : enUS;

  if (differenceInDays(now, dateObj) > 6) {
    return new Intl.DateTimeFormat(locale).format(dateObj);
  }

  return formatRelative(dateObj, now, { locale: dateFnsLocale });
}

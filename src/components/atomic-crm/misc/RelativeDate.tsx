/* eslint-disable react-refresh/only-export-components */
import { differenceInDays, formatRelative } from "date-fns";
import { enUS, es, fr } from "date-fns/locale";
import { useLocaleState } from "ra-core";

const getDateFnsLocale = (locale: string) =>
  locale.startsWith("fr") ? fr : locale.startsWith("es") ? es : enUS;

export const formatLocalizedDate = (date: string, locale = "en") =>
  new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));

export const formatRelativeDate = (date: string, locale = "en") => {
  const dateObj = new Date(date);
  const now = new Date();
  const dateFnsLocale = getDateFnsLocale(locale);

  if (differenceInDays(now, dateObj) > 6) {
    return new Intl.DateTimeFormat(locale).format(dateObj);
  }

  return formatRelative(dateObj, now, { locale: dateFnsLocale });
};

export const useRelativeDate = (date: string) => {
  const [locale = "en"] = useLocaleState();

  return formatRelativeDate(date, locale);
};

export function RelativeDate({ date }: { date: string }) {
  return useRelativeDate(date);
}

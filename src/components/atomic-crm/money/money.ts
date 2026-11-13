/**
 * Money in the CRM: integers in the smallest unit of their currency (kopecks,
 * grosze, cents) next to an ISO 4217 code, never floats. Conversions to and
 * from what people type and read happen only here.
 */

const minorDigitsCache = new Map<string, number>();

/** Digits after the decimal point of a currency (2 for UAH and PLN, 0 for JPY). */
export const getMinorDigits = (currency: string): number => {
  const cached = minorDigitsCache.get(currency);
  if (cached !== undefined) return cached;
  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  minorDigitsCache.set(currency, digits);
  return digits;
};

/** 12.5 hryvnias → 1250 kopecks. Rounds to the nearest minor unit. */
export const toMinor = (major: number, currency: string): number =>
  Math.round(major * 10 ** getMinorDigits(currency));

/** 1250 kopecks → 12.5 hryvnias, for inputs and charts only. */
export const fromMinor = (minor: number, currency: string): number =>
  minor / 10 ** getMinorDigits(currency);

export interface FormatMoneyOptions {
  /** "12K ₴" instead of "12 400,00 ₴" */
  compact?: boolean;
  /** Show the sign of positive amounts too ("+1 200 ₴") */
  signed?: boolean;
}

/**
 * Formats an amount in minor units the way people of the business country
 * write it: "12 400,00 ₴" in uk-UA, "12 400,00 zł" in pl-PL.
 */
export const formatMoney = (
  minor: number,
  currency: string,
  locale: string,
  { compact = false, signed = false }: FormatMoneyOptions = {},
): string =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    signDisplay: signed ? "exceptZero" : "auto",
    ...(compact ? { notation: "compact", minimumSignificantDigits: 3 } : {}),
  }).format(fromMinor(minor, currency));

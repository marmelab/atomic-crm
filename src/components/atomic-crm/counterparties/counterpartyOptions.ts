/**
 * Choices of a counterparty card (TZ section 5.1). Requisites and their checks
 * come from the country packs; this file only lists what can be picked.
 */

export const COUNTERPARTY_KINDS = [
  "company",
  "sole_proprietor",
  "person",
] as const;
export type CounterpartyKind = (typeof COUNTERPARTY_KINDS)[number];

export const COUNTERPARTY_ROLES = ["client", "supplier", "partner"] as const;
export type CounterpartyRole = (typeof COUNTERPARTY_ROLES)[number];

/** Member states of the EU, as VIES names them (Greece is EL there). */
export const EU_COUNTRY_CODES = [
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
] as const;

/**
 * Countries a counterparty can be from: the markets of the TZ (section 2) and
 * the usual trading partners. Russia and Belarus are not listed (sanctions).
 */
export const COUNTERPARTY_COUNTRY_CODES = [
  "UA",
  ...EU_COUNTRY_CODES.filter((code) => code !== "PL"),
  "PL",
  "CA",
  "CH",
  "GB",
  "GE",
  "KZ",
  "MD",
  "NO",
  "TR",
  "US",
  "UZ",
] as const;

export const isEuCountry = (code: string | null | undefined): boolean =>
  !!code && (EU_COUNTRY_CODES as readonly string[]).includes(code);

/** Country name in the interface language: "Польща", "Poland". */
export const countryName = (code: string, locale: string): string => {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

/** Countries sorted by their name in the interface language. */
export const countryChoices = (
  locale: string,
): { id: string; name: string }[] =>
  [...COUNTERPARTY_COUNTRY_CODES]
    .map((code) => ({ id: code, name: countryName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

/** Currencies offered for the terms of a counterparty. */
export const TERMS_CURRENCIES = ["UAH", "PLN", "EUR", "USD"] as const;

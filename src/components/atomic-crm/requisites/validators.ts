/**
 * Checks of company requisites (tax and registry numbers, bank accounts).
 *
 * The database runs the same checks (public.requisite_is_valid) and is the
 * authority; these give the user an immediate hint while typing. Which field
 * uses which validator comes from the country pack (requisite_fields table),
 * never from the code.
 */

export const REQUISITE_VALIDATORS = [
  "edrpou",
  "ipn",
  "nip",
  "regon",
  "iban",
] as const;

export type RequisiteValidator = (typeof REQUISITE_VALIDATORS)[number];

// Sanctions: bank accounts in Russia and Belarus are not accepted (TZ section 2)
const BLOCKED_IBAN_COUNTRIES = ["RU", "BY"];

const IBAN_LENGTHS: Record<string, number> = {
  UA: 29,
  PL: 28,
};

const digitsOnly = (value: string): number[] | null =>
  /^\d+$/.test(value) ? value.split("").map(Number) : null;

const weightedSum = (digits: number[], weights: number[]): number =>
  weights.reduce((sum, weight, index) => sum + weight * digits[index], 0);

/** Ukrainian legal entity code (ЄДРПОУ): 8 digits with a check digit. */
export const isValidEdrpou = (value: string): boolean => {
  const digits = digitsOnly(value);
  if (!digits || digits.length !== 8) return false;

  const number = Number(value);
  const baseWeights =
    number < 30000000 || number > 60000000
      ? [1, 2, 3, 4, 5, 6, 7]
      : [7, 1, 2, 3, 4, 5, 6];

  let remainder = weightedSum(digits, baseWeights) % 11;
  if (remainder === 10) {
    const shiftedWeights = baseWeights.map((weight) => weight + 2);
    remainder = weightedSum(digits, shiftedWeights) % 11;
    if (remainder === 10) remainder = 0;
  }
  return remainder === digits[7];
};

/** Ukrainian individual tax number (РНОКПП / ІПН): 10 digits with a check digit. */
export const isValidIpn = (value: string): boolean => {
  const digits = digitsOnly(value);
  if (!digits || digits.length !== 10) return false;
  const sum = weightedSum(digits, [-1, 5, 7, 9, 4, 6, 10, 5, 7]);
  return (((sum % 11) + 11) % 11) % 10 === digits[9];
};

/** Polish tax number (NIP): 10 digits with a check digit. */
export const isValidNip = (value: string): boolean => {
  const digits = digitsOnly(value);
  if (!digits || digits.length !== 10) return false;
  const control = weightedSum(digits, [6, 5, 7, 2, 3, 4, 5, 6, 7]) % 11;
  return control !== 10 && control === digits[9];
};

const regonControl = (digits: number[], weights: number[]): number => {
  const control = weightedSum(digits, weights) % 11;
  return control === 10 ? 0 : control;
};

/** Polish business registry number (REGON): 9 or 14 digits with check digits. */
export const isValidRegon = (value: string): boolean => {
  const digits = digitsOnly(value);
  if (!digits || (digits.length !== 9 && digits.length !== 14)) return false;
  const short = digits.slice(0, 9);
  if (regonControl(short, [8, 9, 2, 3, 4, 5, 6, 7]) !== short[8]) return false;
  if (digits.length === 9) return true;
  return (
    regonControl(digits, [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8]) === digits[13]
  );
};

/**
 * International bank account number. Spaces are ignored; the country code
 * must have a known length, and the mod-97 check must give 1.
 */
export const isValidIban = (value: string): boolean => {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;

  const country = iban.slice(0, 2);
  if (BLOCKED_IBAN_COUNTRIES.includes(country)) return false;
  const expectedLength = IBAN_LENGTHS[country];
  if (expectedLength !== undefined && iban.length !== expectedLength) {
    return false;
  }
  if (iban.length < 15 || iban.length > 34) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of code) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
};

const VALIDATORS: Record<RequisiteValidator, (value: string) => boolean> = {
  edrpou: isValidEdrpou,
  ipn: isValidIpn,
  nip: isValidNip,
  regon: isValidRegon,
  iban: isValidIban,
};

export const isRequisiteValidator = (
  value: unknown,
): value is RequisiteValidator =>
  typeof value === "string" &&
  (REQUISITE_VALIDATORS as readonly string[]).includes(value);

/** Normalizes what the user typed: trims, drops spaces (and dashes in numbers). */
export const normalizeRequisite = (
  validator: RequisiteValidator,
  value: string,
): string => {
  const compact = value.replace(/\s+/g, "");
  return validator === "iban"
    ? compact.toUpperCase()
    : compact.replace(/-/g, "");
};

export const isValidRequisite = (
  validator: RequisiteValidator,
  value: string,
): boolean => VALIDATORS[validator](normalizeRequisite(validator, value));

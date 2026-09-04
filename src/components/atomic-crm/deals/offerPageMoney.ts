// Payment domain foundation slice, human-acceptance repair: the public
// Offer Page must make the currency explicit (Leif works with
// international clients — a bare "$" is ambiguous between USD/CAD/AUD/
// etc.). Reuses this app's own existing currency source of truth
// (ConfigurationContextValue.currency, an ISO 4217 code — see
// root/ConfigurationContext.tsx — the same value every other money
// display in this app already reads via Intl.NumberFormat) rather than
// hardcoding "USD": the symbol/format come from Intl for whatever currency
// is actually configured, with the currency code appended explicitly so
// it's never ambiguous regardless of symbol. Whole-amount only (no cents)
// — matches this app's own real data, which is never fractional (GYU's
// $1,400/$700/$350, LE's $4,000).
export const formatOfferPageAmount = (
  amount: number,
  currency: string,
): string => {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} ${currency}`;
};

/**
 * Format a number as Eswatini Lilangeni (SZL).
 * Returns "E5,000.00" format.
 *
 * Do NOT use Intl.NumberFormat('en-SZ', { style: 'currency', currency: 'SZL' }) —
 * most browsers render it as "SZL 5,000.00" which is wrong. Local convention is "E" prefix.
 */
export const formatSZL = (amount: number | null | undefined): string => {
  if (amount == null || isNaN(amount)) return "—";
  const [intPart, decPart] = amount.toFixed(2).split(".");
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `E${intFormatted}.${decPart}`;
};

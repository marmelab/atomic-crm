import type { CompanySize } from "../types";

export const sizes = [
  { id: 50, name: "Fewer than 50 employees" },
  { id: 100, name: "50-100 employees" },
  { id: 250, name: "100-250 employees" },
  { id: 500, name: "250-500 employees" },
  { id: 1000, name: "More than 500 employees" },
];

/**
 * Coerces an arbitrary imported headcount into one of the sizes above, which is
 * the only set the company forms and filters can render.
 */
export const mapSizeToCategory = (size: number): CompanySize => {
  if (size < 50) return 50;
  if (size <= 100) return 100;
  if (size <= 250) return 250;
  if (size <= 500) return 500;
  return 1000;
};

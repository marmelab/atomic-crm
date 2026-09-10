export const sizes = [
  { id: 1, name: "1 employee" },
  { id: 10, name: "2-9 employees" },
  { id: 50, name: "10-49 employees" },
  { id: 250, name: "50-249 employees" },
  { id: 500, name: "250 or more employees" },
];

/**
 * Coerces an arbitrary imported headcount into one of the sizes above, which is
 * the only set the company forms and filters can render.
 */
export const mapSizeToCategory = (size: number): 1 | 10 | 50 | 250 | 500 => {
  if (size === 1) return 1;
  if (size < 10) return 10;
  if (size < 50) return 50;
  if (size < 250) return 250;
  return 500;
};

export const roundFiscalOutput = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

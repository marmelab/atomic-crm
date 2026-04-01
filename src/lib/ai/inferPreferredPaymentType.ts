/**
 * Infer payment type from natural language question.
 * Longest match first: "rimborso spese" before bare "rimborso".
 */
export const inferPreferredPaymentType = (
  normalizedQuestion: string,
): string | null => {
  const includes = (kw: string) => normalizedQuestion.includes(kw);

  if (includes("rimborso spese") || includes("spes")) return "rimborso_spese";
  if (includes("rimborso")) return "rimborso";
  if (includes("acconto") || includes("anticip")) return "acconto";
  if (includes("saldo") || includes("residu") || includes("chiuder"))
    return "saldo";
  if (includes("parzial")) return "parziale";
  return null;
};

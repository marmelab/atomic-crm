import { describe, it, expect } from "vitest";
import { buildFiscalObligationMergeKey } from "./buildFiscalDeadlineKey";

describe("buildFiscalObligationMergeKey", () => {
  it("builds key from component + competenceYear + dueDate", () => {
    const key = buildFiscalObligationMergeKey({
      component: "imposta_saldo",
      competenceYear: 2025,
      dueDate: "2026-06-30",
    });
    expect(key).toBe("imposta_saldo::2025::2026-06-30");
  });

  it("different components on same date produce different keys", () => {
    const key1 = buildFiscalObligationMergeKey({
      component: "imposta_saldo",
      competenceYear: 2025,
      dueDate: "2026-06-30",
    });
    const key2 = buildFiscalObligationMergeKey({
      component: "inps_saldo",
      competenceYear: 2025,
      dueDate: "2026-06-30",
    });
    expect(key1).not.toBe(key2);
  });
});

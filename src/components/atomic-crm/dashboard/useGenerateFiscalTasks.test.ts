import { describe, expect, it } from "vitest";

import {
  buildFiscalTaskDrafts,
  buildFiscalTaskIdentity,
  buildFiscalTaskType,
} from "./useGenerateFiscalTasks";
import type { FiscalDeadline } from "./fiscalModelTypes";

const baseDeadline = (
  overrides: Partial<FiscalDeadline> = {},
): FiscalDeadline => ({
  paymentYear: 2026,
  method: "historical",
  supportingTaxYears: [2025, 2026],
  confidence: "estimated",
  assumptions: {
    configMode: "current_config_reapplied",
    paymentTrackingMode: "local_non_authoritative",
  },
  date: "2026-06-30",
  label: "Saldo + 1° Acconto",
  items: [],
  totalAmount: 0,
  isPast: false,
  daysUntil: 10,
  priority: "high",
  ...overrides,
});

describe("useGenerateFiscalTasks helpers", () => {
  it("derives fiscal task type from structured deadline component", () => {
    expect(buildFiscalTaskType("imposta_saldo")).toBe("f24");
    expect(buildFiscalTaskType("inps_acconto_1")).toBe("inps");
    expect(buildFiscalTaskType("bollo")).toBe("bollo");
    expect(buildFiscalTaskType("dichiarazione")).toBe("dichiarazione");
  });

  it("builds a stable fiscal task identity from date, component and competence year", () => {
    expect(
      buildFiscalTaskIdentity({
        date: "2026-06-30",
        component: "imposta_saldo",
        competenceYear: 2025,
      }),
    ).toBe("2026-06-30::imposta_saldo::2025");
  });

  it("deduplicates generated drafts by structured identity, not by rendered copy", () => {
    const drafts = buildFiscalTaskDrafts([
      baseDeadline({
        label: "Saldo + 1° Acconto",
        items: [
          {
            description: "Saldo Imposta Sostitutiva anno precedente",
            amount: 57.67,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
        ],
        totalAmount: 57.67,
      }),
      baseDeadline({
        label: "Saldo stimato + 1° Acconto",
        items: [
          {
            description: "Saldo imposta anno precedente (copy aggiornata)",
            amount: 57.67,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
          {
            description: "1° Acconto INPS Gestione Separata (40%)",
            amount: 162.68,
            competenceYear: 2026,
            component: "inps_acconto_1",
          },
        ],
        totalAmount: 220.35,
      }),
    ]);

    expect(drafts).toHaveLength(2);
    expect(drafts.map((draft) => draft.key)).toEqual([
      "2026-06-30::imposta_saldo::2025",
      "2026-06-30::inps_acconto_1::2026",
    ]);
    expect(drafts[0]?.payload.type).toBe("f24");
    expect(drafts[1]?.payload.type).toBe("inps");
    expect(drafts[0]?.payload.due_date).toBe("2026-06-29T22:00:00.000Z");
  });
});

import { describe, expect, it } from "vitest";

import {
  buildDeadlineNotificationMessage,
  buildFiscalDeadlines,
  buildTaskPayloads,
  computeFiscalEstimates,
  type FiscalConfig,
} from "./fiscalDeadlineCalculation.ts";

const fiscalConfig: FiscalConfig = {
  taxProfiles: [
    {
      atecoCode: "ATECO-TV",
      coefficienteReddititivita: 78,
      linkedCategories: ["produzione_tv"],
    },
  ],
  aliquotaINPS: 26,
  tettoFatturato: 85000,
  annoInizioAttivita: 2020,
};

describe("computeFiscalEstimates", () => {
  it("classifies payment year in Europe/Rome at UTC year boundary", () => {
    const estimates = computeFiscalEstimates({
      config: fiscalConfig,
      currentYear: 2027,
      payments: [
        {
          amount: 1000,
          payment_date: "2026-12-31T23:30:00.000Z",
          project_id: "project-1",
          status: "ricevuto",
        },
      ],
      projects: [{ id: "project-1", category: "produzione_tv" }],
    });

    expect(estimates.stimaInpsAnnuale).toBeCloseTo(202.8);
    expect(estimates.stimaImpostaAnnuale).toBeCloseTo(86.58);
  });
});

describe("buildFiscalDeadlines", () => {
  it("computes isPast and daysUntil from business dates", () => {
    const deadlines = buildFiscalDeadlines({
      stimaImpostaAnnuale: 1000,
      stimaInpsAnnuale: 1000,
      annoInizioAttivita: 2020,
      currentYear: 2026,
      todayIso: "2026-06-29",
    });

    expect(deadlines[0]).toMatchObject({
      date: "2026-06-30",
      isPast: false,
      daysUntil: 1,
    });
  });
});

describe("buildTaskPayloads", () => {
  it("creates due_date at start of Europe/Rome business day", () => {
    const payloads = buildTaskPayloads([
      {
        date: "2026-06-30",
        label: "Saldo + 1° Acconto",
        items: [{ description: "Saldo Imposta", amount: 100 }],
        totalAmount: 100,
        isPast: false,
        daysUntil: 1,
        priority: "high",
      },
    ]);

    expect(payloads[0]?.due_date).toBe("2026-06-29T22:00:00.000Z");
  });
});

describe("buildDeadlineNotificationMessage", () => {
  it("formats deadline dates without browser/runtime timezone drift", () => {
    const message = buildDeadlineNotificationMessage([
      {
        date: "2026-06-30",
        label: "Saldo + 1° Acconto",
        items: [{ description: "Saldo Imposta", amount: 100 }],
        totalAmount: 100,
        isPast: false,
        daysUntil: 1,
        priority: "high",
      },
    ]);

    expect(message).toContain("30 giugno 2026");
  });
});

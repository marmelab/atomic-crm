import { describe, expect, it } from "vitest";

import {
  buildAnnualOperationsAiGuidance,
  reframeAnnualOperationsQuestion,
} from "./annualOperationsAiGuidance";

const closedYearContext = {
  meta: {
    selectedYear: 2025,
    isCurrentYear: false,
    asOfDateLabel: "28/02/2026",
  },
  metrics: [
    {
      id: "annual_work_value",
      value: 20582,
      formattedValue: "20.582 EUR",
    },
    {
      id: "pending_payments_total",
      value: 0,
      formattedValue: "0 EUR",
    },
    {
      id: "open_quotes_amount",
      value: 0,
      formattedValue: "0 EUR",
    },
    {
      id: "annual_expenses_total",
      value: 1200,
      formattedValue: "1.200 EUR",
    },
  ],
  topClients: [
    {
      clientName: "ASSOCIAZIONE CULTURALE GUSTARE SICILIA",
      revenue: 20582,
    },
  ],
};

const currentYearContext = {
  meta: {
    selectedYear: 2026,
    isCurrentYear: true,
    asOfDateLabel: "08/03/2026",
  },
  metrics: [
    {
      id: "annual_work_value",
      value: 5000,
      formattedValue: "5.000 EUR",
    },
    {
      id: "pending_payments_total",
      value: 1000,
      formattedValue: "1.000 EUR",
    },
    {
      id: "open_quotes_amount",
      value: 0,
      formattedValue: "0 EUR",
    },
    {
      id: "annual_expenses_total",
      value: 800,
      formattedValue: "800 EUR",
    },
  ],
  topClients: [
    { clientName: "Cliente A", revenue: 3000 },
    { clientName: "Cliente B", revenue: 2000 },
  ],
};

const zeroExpensesContext = {
  meta: {
    selectedYear: 2025,
    isCurrentYear: false,
    asOfDateLabel: "28/02/2026",
  },
  metrics: [
    { id: "annual_work_value", value: 10000, formattedValue: "10.000 EUR" },
    { id: "pending_payments_total", value: 0, formattedValue: "0 EUR" },
    { id: "open_quotes_amount", value: 0, formattedValue: "0 EUR" },
    { id: "annual_expenses_total", value: 0, formattedValue: "0 EUR" },
  ],
  topClients: [{ clientName: "Cliente Unico", revenue: 10000 }],
};

describe("buildAnnualOperationsAiGuidance", () => {
  it("hardens closed-year interpretation so zeros are not treated as automatic problems", () => {
    const guidance = buildAnnualOperationsAiGuidance({
      mode: "answer",
      context: closedYearContext,
      question: "Qual è il punto più debole da controllare?",
    });

    expect(guidance).toContain(
      'Parla sempre di "nei dati registrati per il 2025" oppure "nel perimetro del 2025".',
    );
    expect(guidance).toContain(
      `Se i pagamenti da ricevere sono 0, limita la frase a "nel perimetro del 2025 non risultano incassi attesi aperti". Non chiamarlo problema automatico.`,
    );
    expect(guidance).toContain(
      'Se la domanda cerca un punto debole, rispondi come "segnale piu fragile visibile nei dati", non come verdetto assoluto sull\'azienda.',
    );
    expect(guidance).toContain(
      "In questo contesto il segnale fragile piu supportato e la concentrazione su un solo cliente (ASSOCIAZIONE CULTURALE GUSTARE SICILIA), non i valori a 0 da soli.",
    );
  });

  it("pushes trainando questions toward positive drivers instead of generic alarms", () => {
    const guidance = buildAnnualOperationsAiGuidance({
      mode: "answer",
      context: closedYearContext,
      question: "Cosa sta trainando quest'anno?",
    });

    expect(guidance).toContain(
      "La domanda chiede cosa sta trainando: concentrati sui driver positivi dimostrabili come categoria principale, cliente dominante e mesi piu forti.",
    );
    expect(guidance).toContain(
      "Non chiudere la risposta con allarmi su zeri o mancanze se la domanda non lo chiede.",
    );
  });

  it("reframes ambiguous annual questions into safer internal instructions", () => {
    const weakPointQuestion = reframeAnnualOperationsQuestion({
      context: closedYearContext,
      question: "Qual è il punto più debole da controllare?",
    });
    const paymentsQuestion = reframeAnnualOperationsQuestion({
      context: closedYearContext,
      question: "Cosa raccontano pagamenti e preventivi aperti?",
    });

    expect(weakPointQuestion).toContain(
      "Qual e il segnale piu fragile visibile nei dati registrati per il 2025?",
    );
    expect(weakPointQuestion).toContain(
      "Non trattare valori a 0, da soli, come problemi automatici",
    );
    expect(paymentsQuestion).toContain(
      "Descrivi i dati senza inferire problemi nascosti o registrazioni mancanti partendo da valori a 0.",
    );
  });

  it("adds provisional caveat for expenses in current year", () => {
    const guidance = buildAnnualOperationsAiGuidance({
      mode: "summary",
      context: currentYearContext,
    });

    expect(guidance).toContain(
      "Le spese e il margine lordo del 2026 sono provvisori perche l'anno non e chiuso.",
    );
  });

  it("does NOT add provisional caveat for closed year with expenses", () => {
    const guidance = buildAnnualOperationsAiGuidance({
      mode: "summary",
      context: closedYearContext,
    });

    expect(guidance).not.toContain("provvisori");
  });

  it("adds zero-expenses guidance when expenses are 0", () => {
    const guidance = buildAnnualOperationsAiGuidance({
      mode: "summary",
      context: zeroExpensesContext,
    });

    expect(guidance).toContain(
      'Se le spese operative sono 0, limita la frase a "nel perimetro del 2025 non risultano spese registrate". Non chiamarlo problema automatico.',
    );
  });

  it("adds expense/margin guidance for questions about spese or margini", () => {
    const guidance = buildAnnualOperationsAiGuidance({
      mode: "answer",
      context: currentYearContext,
      question: "Qual è il margine lordo finora?",
    });

    expect(guidance).toContain(
      "Se la domanda riguarda spese o margini, usa la sezione expenses del contesto.",
    );
    expect(guidance).toContain(
      `Per il 2026 in corso, spese e margini sono provvisori: dillo esplicitamente.`,
    );
  });

  it("reframes expense/cost questions with correct time qualifier", () => {
    const currentYearReframe = reframeAnnualOperationsQuestion({
      context: currentYearContext,
      question: "Quanto ho speso finora?",
    });
    const closedYearReframe = reframeAnnualOperationsQuestion({
      context: closedYearContext,
      question: "Qual era il margine nel 2025?",
    });

    expect(currentYearReframe).toContain("dati provvisori, anno non chiuso");
    expect(currentYearReframe).toContain(
      "Distingui il margine lordo operativo dal reddito fiscale",
    );
    expect(closedYearReframe).toContain("nei dati registrati per il 2025");
    expect(closedYearReframe).not.toContain("provvisori");
  });
});

import { diffBusinessDays } from "@/lib/dateTimezone";
import type { FiscalDeadline, DeadlineItem } from "./fiscalModelTypes";

const isoDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const buildDeadlineTiming = (date: string, todayIso: string) => {
  const daysUntil = diffBusinessDays(todayIso, date) ?? 0;
  return {
    isPast: daysUntil < 0,
    daysUntil,
  };
};

// ── Deadlines builder ─────────────────────────────────────────────────

/**
 * Builds fiscal deadlines for regime forfettario.
 *
 * Acconti split: 50/50 (D.L. 124/2019 art. 58 for ISA/forfettari subjects).
 * INPS advances: 80% of estimated annual total.
 *
 * June 30: Saldo anno precedente + 1° acconto anno corrente
 * November 30: 2° acconto anno corrente (not installable)
 */
export const buildDeadlines = ({
  stimaImpostaAnnuale,
  stimaInpsAnnuale,
  annoInizioAttivita,
  currentYear,
  todayIso,
}: {
  stimaImpostaAnnuale: number;
  stimaInpsAnnuale: number;
  annoInizioAttivita: number;
  currentYear: number;
  todayIso: string;
}): FiscalDeadline[] => {
  // First year: no deadlines (no previous year to settle)
  if (annoInizioAttivita === currentYear) return [];

  const deadlines: FiscalDeadline[] = [];

  // Acconto thresholds for imposta sostitutiva
  const hasDoubleAcconto = stimaImpostaAnnuale > 257.52;
  const hasSingleAcconto = stimaImpostaAnnuale >= 51.65 && !hasDoubleAcconto;

  // June 30 deadline
  const juneDate = isoDate(currentYear, 6, 30);
  const juneItems: DeadlineItem[] = [];

  // Saldo imposta anno precedente (full estimate minus advances)
  juneItems.push({
    description: "Saldo Imposta Sostitutiva anno precedente",
    amount: stimaImpostaAnnuale,
  });

  // Saldo INPS anno precedente (20% not covered by advances)
  juneItems.push({
    description: "Saldo INPS anno precedente (20%)",
    amount: stimaInpsAnnuale * 0.2,
  });

  // 1° acconto imposta (50% if double, 0 if single — goes to November)
  if (hasDoubleAcconto) {
    juneItems.push({
      description: "1° Acconto Imposta Sostitutiva (50%)",
      amount: stimaImpostaAnnuale * 0.5,
    });
  }

  // 1° acconto INPS (40% of total = 80% × 50%)
  juneItems.push({
    description: "1° Acconto INPS Gestione Separata (40%)",
    amount: stimaInpsAnnuale * 0.4,
  });

  const juneTotalAmount = juneItems.reduce((s, i) => s + i.amount, 0);
  const juneTiming = buildDeadlineTiming(juneDate, todayIso);
  deadlines.push({
    date: juneDate,
    label: "Saldo + 1° Acconto",
    items: juneItems,
    totalAmount: juneTotalAmount,
    isPast: juneTiming.isPast,
    daysUntil: juneTiming.daysUntil,
    priority: "high",
    paidAmount: null,
    paidDate: null,
  });

  // November 30 deadline
  const novDate = isoDate(currentYear, 11, 30);
  const novItems: DeadlineItem[] = [];

  if (hasDoubleAcconto) {
    novItems.push({
      description: "2° Acconto Imposta Sostitutiva (50%)",
      amount: stimaImpostaAnnuale * 0.5,
    });
  } else if (hasSingleAcconto) {
    novItems.push({
      description: "Acconto Unico Imposta Sostitutiva (100%)",
      amount: stimaImpostaAnnuale,
    });
  }

  // 2° acconto INPS (40% of total = 80% × 50%)
  novItems.push({
    description: "2° Acconto INPS Gestione Separata (40%)",
    amount: stimaInpsAnnuale * 0.4,
  });

  const novTotalAmount = novItems.reduce((s, i) => s + i.amount, 0);
  const novTiming = buildDeadlineTiming(novDate, todayIso);
  deadlines.push({
    date: novDate,
    label: "2° Acconto",
    items: novItems,
    totalAmount: novTotalAmount,
    isPast: novTiming.isPast,
    daysUntil: novTiming.daysUntil,
    priority: "high",
    paidAmount: null,
    paidDate: null,
  });

  deadlines.push(...buildLowPriorityDeadlines(currentYear, todayIso));

  // Sort: future first by date, then past by date descending
  deadlines.sort((a, b) => {
    if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
    if (!a.isPast) return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date);
  });

  return deadlines;
};

// ── Low-priority deadlines (bollo, dichiarazione) ───────────────────

const buildLowPriorityDeadlines = (
  currentYear: number,
  todayIso: string,
): FiscalDeadline[] => {
  const result: FiscalDeadline[] = [];

  // Bollo trimestrale sulle fatture elettroniche
  const bolloQuarters: Array<{ date: string; label: string }> = [
    { date: isoDate(currentYear, 5, 31), label: "Bollo Q1 (gen-mar)" },
    { date: isoDate(currentYear, 9, 30), label: "Bollo Q2 (apr-giu)" },
    { date: isoDate(currentYear, 11, 30), label: "Bollo Q3 (lug-set)" },
    { date: isoDate(currentYear + 1, 2, 28), label: "Bollo Q4 (ott-dic)" },
  ];

  for (const bq of bolloQuarters) {
    const timing = buildDeadlineTiming(bq.date, todayIso);
    result.push({
      date: bq.date,
      label: bq.label,
      items: [
        {
          description: `Imposta di bollo fatture elettroniche — ${bq.label}`,
          amount: 0,
        },
      ],
      totalAmount: 0,
      isPast: timing.isPast,
      daysUntil: timing.daysUntil,
      priority: "low",
      paidAmount: null,
      paidDate: null,
    });
  }

  // Dichiarazione dei redditi (Modello Redditi PF) — October 31
  const dichDate = isoDate(currentYear, 10, 31);
  const dichTiming = buildDeadlineTiming(dichDate, todayIso);
  result.push({
    date: dichDate,
    label: "Dichiarazione dei redditi",
    items: [{ description: "Invio telematico Modello Redditi PF", amount: 0 }],
    totalAmount: 0,
    isPast: dichTiming.isPast,
    daysUntil: dichTiming.daysUntil,
    priority: "low",
    paidAmount: null,
    paidDate: null,
  });

  return result;
};

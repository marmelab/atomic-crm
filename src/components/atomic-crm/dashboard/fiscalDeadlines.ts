import type { FiscalDeadline, DeadlineItem } from "./fiscalModelTypes";

// ── Date helpers (shared with fiscalModel.ts) ─────────────────────────

export const toStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const diffDays = (from: Date, to: Date) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(
    (toStartOfDay(to).valueOf() - toStartOfDay(from).valueOf()) / msPerDay,
  );
};

/** Format a local Date as YYYY-MM-DD without UTC conversion. */
const toLocalISODate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  today,
}: {
  stimaImpostaAnnuale: number;
  stimaInpsAnnuale: number;
  annoInizioAttivita: number;
  currentYear: number;
  today: Date;
}): FiscalDeadline[] => {
  // First year: no deadlines (no previous year to settle)
  if (annoInizioAttivita === currentYear) return [];

  const deadlines: FiscalDeadline[] = [];

  // Acconto thresholds for imposta sostitutiva
  const hasDoubleAcconto = stimaImpostaAnnuale > 257.52;
  const hasSingleAcconto = stimaImpostaAnnuale >= 51.65 && !hasDoubleAcconto;

  // June 30 deadline
  const juneDate = new Date(currentYear, 5, 30); // month is 0-indexed
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
  deadlines.push({
    date: toLocalISODate(juneDate),
    label: "Saldo + 1° Acconto",
    items: juneItems,
    totalAmount: juneTotalAmount,
    isPast: juneDate < today,
    daysUntil: diffDays(today, juneDate),
    priority: "high",
  });

  // November 30 deadline
  const novDate = new Date(currentYear, 10, 30);
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
  deadlines.push({
    date: toLocalISODate(novDate),
    label: "2° Acconto",
    items: novItems,
    totalAmount: novTotalAmount,
    isPast: novDate < today,
    daysUntil: diffDays(today, novDate),
    priority: "high",
  });

  deadlines.push(...buildLowPriorityDeadlines(currentYear, today));

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
  today: Date,
): FiscalDeadline[] => {
  const result: FiscalDeadline[] = [];

  // Bollo trimestrale sulle fatture elettroniche
  const bolloQuarters: Array<{ date: Date; label: string }> = [
    { date: new Date(currentYear, 4, 31), label: "Bollo Q1 (gen-mar)" },
    { date: new Date(currentYear, 8, 30), label: "Bollo Q2 (apr-giu)" },
    { date: new Date(currentYear, 10, 30), label: "Bollo Q3 (lug-set)" },
    { date: new Date(currentYear + 1, 1, 28), label: "Bollo Q4 (ott-dic)" },
  ];

  for (const bq of bolloQuarters) {
    result.push({
      date: toLocalISODate(bq.date),
      label: bq.label,
      items: [
        {
          description: `Imposta di bollo fatture elettroniche — ${bq.label}`,
          amount: 0,
        },
      ],
      totalAmount: 0,
      isPast: bq.date < today,
      daysUntil: diffDays(today, bq.date),
      priority: "low",
    });
  }

  // Dichiarazione dei redditi (Modello Redditi PF) — October 31
  const dichDate = new Date(currentYear, 9, 31);
  result.push({
    date: toLocalISODate(dichDate),
    label: "Dichiarazione dei redditi",
    items: [{ description: "Invio telematico Modello Redditi PF", amount: 0 }],
    totalAmount: 0,
    isPast: dichDate < today,
    daysUntil: diffDays(today, dichDate),
    priority: "low",
  });

  return result;
};

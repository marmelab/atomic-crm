/**
 * Auto-generation logic for the Compliance Calendar.
 *
 * Rules are sourced exclusively from docs/COMPLIANCE_FILING_REFERENCE.md.
 * Do NOT invent Eswatini tax rules here — all due dates and conditions
 * must trace back to that reference document.
 */
import {
  addMonths,
  format,
  getDaysInMonth,
  lastDayOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import type {
  Company,
  ComplianceFiling,
  FilingStatus,
  FilingType,
} from "../types";

type FilingDraft = Omit<ComplianceFiling, "id" | "created_at" | "updated_at">;

/** Return the 30th of a month, or the last day if the month has fewer days. */
function the30thOf(year: number, month: number): Date {
  // month is 0-indexed (JS Date convention)
  const day = Math.min(30, getDaysInMonth(new Date(year, month)));
  return new Date(year, month, day);
}

/**
 * Generate all compliance filings for a company for the given Eswatini tax year.
 *
 * @param company   Full company record (must include all compliance fields)
 * @param fyStartYear  The calendar year in which the Eswatini tax year begins.
 *                     e.g. 2026 → FY 2026/2027 (1 Jul 2026 – 30 Jun 2027).
 * @param assignedTo   Optional sales ID to pre-fill on each filing.
 */
export const generateFilingsForCompany = (
  company: Company,
  fyStartYear: number,
  assignedTo?: number | null,
): FilingDraft[] => {
  const filings: FilingDraft[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const make = (
    filing_type: FilingType,
    period_covered: string,
    due_date: Date,
    notes?: string,
  ): FilingDraft => {
    const status: FilingStatus = due_date < today ? "OVERDUE" : "UPCOMING";
    return {
      company_id: company.id,
      filing_type,
      period_covered,
      due_date: format(due_date, "yyyy-MM-dd"),
      submitted_date: null,
      status,
      assigned_to: assignedTo ?? null,
      notes: notes ?? null,
    };
  };

  // ── Company financial year end ─────────────────────────────────────────────
  // financial_year_end_month: 1-12.  Default 6 (June).
  // Determine the FY end date that falls within or immediately after the
  // Eswatini tax year starting 1 Jul fyStartYear.
  const fyEndMonth = company.financial_year_end_month ?? 6;
  // If FY end month is Jul(7)–Dec(12) it falls in fyStartYear; otherwise the next year.
  const fyEndYear = fyEndMonth >= 7 ? fyStartYear : fyStartYear + 1;
  const fyEndDate = lastDayOfMonth(new Date(fyEndYear, fyEndMonth - 1, 1));
  const fyLabel = `FY${fyStartYear}/${fyStartYear + 1}`;

  // ── VAT_RETURN ─────────────────────────────────────────────────────────────
  // Reference: due 30th of month following period end; calendar-month based.
  // We generate for the 12 calendar months that map to this Eswatini tax year
  // (Jul fyStartYear … Jun fyStartYear+1).
  if (company.vat_registered && company.vat_filing_frequency) {
    const freq = company.vat_filing_frequency;

    if (freq === "MONTHLY") {
      for (let i = 0; i < 12; i++) {
        // Month i relative to Jul fyStartYear
        const periodStart = new Date(fyStartYear, 6 + i, 1); // Jul=6 in 0-indexed
        const periodLabel = format(periodStart, "MMM yyyy");
        const dueDate = the30thOf(
          periodStart.getFullYear(),
          periodStart.getMonth() + 1, // following month (0-indexed)
        );
        filings.push(make("VAT_RETURN", periodLabel, dueDate));
      }
    } else if (freq === "BIMONTHLY") {
      // Bi-monthly pattern: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec
      // For the tax year Jul–Jun, the 6 periods are:
      // Jul-Aug, Sep-Oct, Nov-Dec, Jan-Feb, Mar-Apr, May-Jun
      const bimonthlyStarts = [
        new Date(fyStartYear, 6, 1), // Jul
        new Date(fyStartYear, 8, 1), // Sep
        new Date(fyStartYear, 10, 1), // Nov
        new Date(fyStartYear + 1, 0, 1), // Jan
        new Date(fyStartYear + 1, 2, 1), // Mar
        new Date(fyStartYear + 1, 4, 1), // May
      ];
      for (const periodStart of bimonthlyStarts) {
        const periodEnd = addMonths(periodStart, 1);
        const label = `${format(periodStart, "MMM")}–${format(periodEnd, "MMM yyyy")}`;
        const dueDate = the30thOf(
          periodEnd.getFullYear(),
          periodEnd.getMonth() + 1,
        );
        filings.push(make("VAT_RETURN", label, dueDate));
      }
    } else if (freq === "QUARTERLY") {
      // Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec (calendar year quarters)
      // For the tax year Jul–Jun, the 4 periods are:
      // Q3 Jul-Sep fyStartYear, Q4 Oct-Dec fyStartYear, Q1 Jan-Mar fyStartYear+1, Q2 Apr-Jun fyStartYear+1
      const quarters = [
        {
          start: new Date(fyStartYear, 6, 1),
          label: `Q3 Jul–Sep ${fyStartYear}`,
        },
        {
          start: new Date(fyStartYear, 9, 1),
          label: `Q4 Oct–Dec ${fyStartYear}`,
        },
        {
          start: new Date(fyStartYear + 1, 0, 1),
          label: `Q1 Jan–Mar ${fyStartYear + 1}`,
        },
        {
          start: new Date(fyStartYear + 1, 3, 1),
          label: `Q2 Apr–Jun ${fyStartYear + 1}`,
        },
      ];
      for (const { start, label } of quarters) {
        // Quarter ends 2 months after start; due = 30th of month after quarter end
        const quarterEnd = addMonths(start, 2);
        const dueDate = the30thOf(
          quarterEnd.getFullYear(),
          quarterEnd.getMonth() + 1,
        );
        filings.push(make("VAT_RETURN", label, dueDate));
      }
    }
  }

  // ── PAYE_RETURN ───────────────────────────────────────────────────────────
  // Reference: 12 monthly entries; due 7th of following month.
  // Note on the 14th: the electronic TaxEase schedule is due by the 14th, but
  // payment (and the critical deadline) is the 7th.  We set due_date to the 7th
  // per the reference file.
  if (company.paye_registered) {
    for (let i = 0; i < 12; i++) {
      const period = new Date(fyStartYear, 6 + i, 1);
      const label = format(period, "MMM yyyy");
      // 7th of the following month
      const dueDate = new Date(period.getFullYear(), period.getMonth() + 1, 7);
      filings.push(
        make(
          "PAYE_RETURN",
          label,
          dueDate,
          "Payment by 7th. Electronic schedule via TaxEase by 14th.",
        ),
      );
    }

    // ── WORKMENS_COMP ─────────────────────────────────────────────────────────
    // Reference: annual; default 31 March; EDITABLE; confirm against Commissioner letter.
    const wcDueDate = new Date(fyStartYear + 1, 2, 31); // 31 March of following year
    filings.push(
      make(
        "WORKMENS_COMP",
        fyLabel,
        wcDueDate,
        "Confirm exact due date against last Workmen's Compensation Commissioner assessment letter.",
      ),
    );
  }

  // ── PROVISIONAL TAX ───────────────────────────────────────────────────────
  if (company.provisional_tax_registered) {
    const isSoleProp = company.entity_type === "SOLE_PROP";

    // PROV_TAX_FIRST
    // Companies/Trusts/NGOs/Partnerships: FY_end_date − 6 months
    // Sole props (individuals): fixed 31 December
    let pt1Due: Date;
    if (isSoleProp) {
      pt1Due = new Date(fyStartYear, 11, 31); // 31 Dec of fyStartYear (fixed for individuals)
    } else {
      pt1Due = lastDayOfMonth(subMonths(fyEndDate, 6));
    }
    filings.push(make("PROV_TAX_FIRST", fyLabel, pt1Due));

    // PROV_TAX_SECOND
    // Reference: last day of company's financial year
    filings.push(make("PROV_TAX_SECOND", fyLabel, fyEndDate));
  }

  // ── INCOME_TAX_COMPANY ────────────────────────────────────────────────────
  // Reference: 31 October following FY end, regardless of actual FY end date.
  // (PwC states 120-day window measured from 30 June regardless of year-end.)
  const itcDueDate = new Date(fyEndYear, 9, 31); // 31 Oct
  filings.push(
    make(
      "INCOME_TAX_COMPANY",
      fyLabel,
      itcDueDate,
      "Extension to 30 December may be granted on request if prior-year compliance is current.",
    ),
  );

  // ── AFS (internal milestone) ──────────────────────────────────────────────
  // Reference: default 30 September following FY end (1-month buffer before income tax).
  const afsDueDate = new Date(fyEndYear, 8, 30); // 30 Sep
  filings.push(
    make(
      "AFS",
      fyLabel,
      afsDueDate,
      "Internal milestone. AFS must be ready before company income tax return.",
    ),
  );

  // ── TRADING_LICENSE_RENEWAL ───────────────────────────────────────────────
  // Reference: reminder = expiry date − 30 days.
  if (company.trading_license_expiry) {
    const expiry = new Date(company.trading_license_expiry);
    const reminder = subDays(expiry, 30);
    filings.push(
      make(
        "TRADING_LICENSE_RENEWAL",
        format(expiry, "MMM yyyy"),
        reminder,
        `Renew with issuing municipality before ${format(expiry, "dd/MM/yyyy")}.`,
      ),
    );
  }

  // ── TAX_CLEARANCE_RENEWAL ─────────────────────────────────────────────────
  // Reference: reminder = expiry date − 30 days.
  if (company.tax_clearance_certificate_expiry) {
    const tccExpiry = new Date(company.tax_clearance_certificate_expiry);
    const tccReminder = subDays(tccExpiry, 30);
    filings.push(
      make(
        "TAX_CLEARANCE_RENEWAL",
        format(tccExpiry, "MMM yyyy"),
        tccReminder,
        "Verify all tax compliance current before applying. TCC requires PAYE/VAT/IT/Prov Tax all up to date.",
      ),
    );
  }

  // ── NOT AUTO-GENERATED ────────────────────────────────────────────────────
  // GRADED_TAX      — REPEALED Sep 2023. Never auto-generate.
  // PROV_TAX_TOPUP  — Manual only (individual top-up after assessment).
  // WHT_NON_RESIDENT — Manual only (non-resident shareholder/lender exposure).
  // INDEPENDENT_REVIEW — Manual only (add per client where applicable).
  // INCOME_TAX_INDIVIDUAL — Manual only (per-contact filing where practice files for individuals).

  return filings;
};

/** Return the current Eswatini tax year start year.
 *  Eswatini tax year: 1 Jul – 30 Jun.  If today is before 1 Jul, the current
 *  tax year started last year.
 */
export const currentEswatiniFyStartYear = (): number => {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
};

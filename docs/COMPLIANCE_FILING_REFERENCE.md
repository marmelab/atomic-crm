# Compliance Filing Reference — Eswatini Revenue Service

**Authoritative reference for Practice-CRM auto-generation logic.**
This document is the single source of truth for every filing type the Compliance Calendar generates. Claude Code reads this in Phase 3 instead of guessing.

> **Last updated:** 10 May 2026
> **Verifiable against:** [ers.org.sz](https://www.ers.org.sz) · [PwC Eswatini Tax Summaries](https://taxsummaries.pwc.com/eswatini)
> **For Eswatini Consulting use:** verify each rule against the client's actual ERS assignment letters before relying on the defaults. Tax rules change. This document does not.

---

## How to use this document

1. **Claude Code reads this** during Phase 3 of the build (see `CLAUDE_CODE_SPEC_ESWATINI.md`). The auto-generation logic for the Compliance Calendar must conform to the rules here. If a rule contradicts what Claude already "knows," this document wins.
2. **You read this** when you onboard a new client. Each company should be tagged with the registrations it actually has (PAYE-registered? VAT-registered? Provisional taxpayer?) and the system auto-generates the right filings.
3. **Your client reads this** to verify the filing schedule against their own records. If they disagree with a rule, mark it `// TODO: confirm` in this file and overrule the default for that company.

When you find a real-world deviation from this document (a client's filing frequency that doesn't match, an ERS letter with a different due date), **update this file first**, then re-run the auto-generation. The reference file is the contract.

---

## Core concepts (read these once)

### Tax year
The Eswatini tax year runs **1 July to 30 June**. Companies are required to have a 30 June year-end unless the Commissioner of Taxes approves an alternative; alternative year-ends are routinely granted.
*Source: PwC Worldwide Tax Summaries — Eswatini Corporate Tax Administration, last reviewed 30 March 2026.*

### Tax authority
The **Eswatini Revenue Service (ERS)** is the semi-autonomous revenue agency. It administers VAT, PAYE, Income Tax, Provisional Tax, Customs, and other revenue. It replaced the Swaziland Revenue Authority following the country's 2018 rename.

### Single TIN
Eswatini uses a **single Tax Identification Number (TIN)** issued by ERS that covers VAT, PAYE, Income Tax and Provisional Tax. Do not model these as separate registration numbers (unlike SARS in South Africa, which uses separate numbers per tax type).

### Submission systems
- **TaxEase** is the current ERS electronic platform for VAT, PAYE, Income Tax and Provisional Tax returns.
- **ORMB** (Oracle Revenue Management and Billing) is the back-end system used since December 2023.
- **e-Tax** was the predecessor; some older documentation still references it.
- Paper forms remain in use for some processes; ERS branches accept walk-ins.

### Currency
**SZL** (Lilangeni / Emalangeni — abbreviated **E**, e.g. E5,000). Pegged 1:1 with ZAR under the Common Monetary Area; ZAR is also legal tender.

---

## Filing types — full reference

The sections below describe every filing type the Compliance Calendar can generate. Each has a unique `code` that matches the `filing_type` enum in the `compliance_filings` Postgres table.

---

### `VAT_RETURN` — Value Added Tax Return

| | |
|---|---|
| **Legal basis** | VAT Act 2011 + VAT Regulations |
| **Who must file** | Any business registered for VAT. Registration is compulsory if annual taxable turnover exceeds **E500,000**; voluntary registration is permitted below that. |
| **VAT rate** | Standard 15%. Zero-rated: exports, basic foodstuffs, petrol/paraffin, medicines, educational books, certain agricultural supplies. Exempt: financial services, land, gambling, water, charities, postal services, dwellings, education, health, welfare. |
| **Filing frequency** | Monthly, bi-monthly, or quarterly — assigned by ERS at registration. Large taxpayers usually monthly. The frequency for a given client is on their VAT registration certificate. |
| **Form** | Filed electronically via **TaxEase / ORMB**. Paper VAT200 form historically. Since 1 July 2023, a detailed VAT Schedule must accompany every return (uploaded to ORMB since December 2023). |
| **Default due date logic** | The 30th of the month following the period end. *Verify in the client's VAT registration letter.* For monthly: 30th of next month. For bi-monthly: 30th of month after period (e.g. Jan-Feb period due 30 March). For quarterly: 30th of month after quarter end. |
| **Period covered** | Calendar months. Bi-monthly typical pattern: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec. |
| **Penalty** | Penalties and interest under the VAT Act for late filing or late payment. Specific amounts vary; see the Act for current schedules. |

**Auto-generation rules (for Compliance Calendar):**
```
IF company.vat_registered = TRUE:
  IF vat_filing_frequency = 'MONTHLY':
    Generate 12 entries, one per calendar month, due 30th of following month
  IF vat_filing_frequency = 'BIMONTHLY':
    Generate 6 entries (Jan-Feb, Mar-Apr, ..., Nov-Dec), due 30th of month after period end
  IF vat_filing_frequency = 'QUARTERLY':
    Generate 4 entries (Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec), due 30th of month after quarter end
```

---

### `PAYE_RETURN` — Monthly PAYE Return

| | |
|---|---|
| **Legal basis** | Income Tax Order 1975, Second Schedule (PAYE) |
| **Who must file** | Every employer paying remuneration in Eswatini. Employers must deduct PAYE under the prescribed Employees' Tax Deduction Tables (daily / weekly / monthly variants) and remit to ERS. |
| **Rates** | Progressive: 20% up to E100,000 → 25% (E100k–150k) → 30% (E150k–200k) → 33% (E200k+). Annual rebate E8,200 (E10,900 if employee is over 60). Effective threshold: no tax below E41,000 annual income. |
| **Form** | **PAYE 04 — Monthly PAYE Declaration Return** (paper) OR electronic submission via **TaxEase Monthly PAYE Schedule** (effective 1 July 2024). |
| **Payment due** | **7th day of the following month** — payment must reach ERS by the 7th together with the return. |
| **Submission due (TaxEase)** | **14 days after end of month** for the electronic Monthly PAYE Schedule. The payment-by-7th rule still applies. |
| **Annual reconciliation** | Historically due **30 September** as PAYE05 reconciliation. From the 2024/2025 tax year, the 12 accumulated monthly TaxEase submissions REPLACE the separate annual reconciliation — provided all 12 are submitted correctly. |
| **Period covered** | One calendar month. |

**Auto-generation rules:**
```
IF company.paye_registered = TRUE:
  Generate 12 entries (one per calendar month for the upcoming tax year),
    period_covered = e.g. "Jul 2026"
    due_date = 7th of the following month
    notes = "Payment by 7th. Electronic schedule via TaxEase by 14th."
```

> **No separate annual PAYE reconciliation entry is auto-generated** for tax years from 2024/2025 onwards. The monthly TaxEase submissions cumulatively replace it. For older tax years where reconciliation is still outstanding, manually create a `PAYE_RECON_LEGACY` entry.

---

### `PROV_TAX_FIRST` — Provisional Tax Instalment 1

| | |
|---|---|
| **Legal basis** | Income Tax Order 1975 |
| **Who must file** | Every company. Every individual provisional taxpayer (e.g. a director earning fees not subject to PAYE; a sole proprietor; a person with significant non-employment income). |
| **Calculation** | Estimate of total tax payable for the year of assessment. Estimate must not be less than the taxable income from the latest preceding assessment (issued not less than 21 days before the current estimate is made), unless the taxpayer can convince the Commissioner that current-year income will be lower. |
| **Form** | Provisional tax return — file via TaxEase. |
| **Companies — due date** | **Within six months of the company's financial year-end** (mid-tax-year). For the standard 30 June year-end this = **31 December**. |
| **Individuals — due date** | **31 December** (fixed; individual tax year is always 1 July – 30 June). |

**Auto-generation rules:**
```
IF company.provisional_tax_registered = TRUE:
  IF entity_type IN ('PTY_LTD', 'PUBLIC_CO', 'TRUST', 'NGO', 'PARTNERSHIP'):
    due_date = financial_year_end_date - 6 months
    e.g. FY end 30 June 2027 → 1st provisional due 31 December 2026
  IF entity_type IN ('SOLE_PROP') OR contact is individual provisional taxpayer:
    due_date = 31 December (fixed)
```

---

### `PROV_TAX_SECOND` — Provisional Tax Instalment 2

| | |
|---|---|
| **Legal basis** | Income Tax Order 1975 |
| **Who must file** | Same as PROV_TAX_FIRST. |
| **Companies — due date** | **No later than the last day of the company's financial year**. Standard 30 June year-end = **30 June**. |
| **Individuals — due date** | **30 June**. |
| **Penalty** | Liable to penalty if the second-instalment estimate of taxable income is BOTH less than 90% of the final taxable income AND less than the immediately preceding year's assessment. |

**Auto-generation rules:**
```
IF company.provisional_tax_registered = TRUE:
  due_date = financial_year_end_date
  e.g. FY end 30 June 2027 → 2nd provisional due 30 June 2027
```

---

### `PROV_TAX_TOPUP` — Provisional Tax Top-Up (individuals only)

| | |
|---|---|
| **Legal basis** | Income Tax Order 1975 |
| **Who must file** | Individual provisional taxpayers who underestimated and need to top up. |
| **Due date** | **31 December of the following year** — i.e. one year after the first provisional tax payment. |

**Auto-generation rules:**
```
Do NOT auto-generate by default. Create manually if a top-up is needed for a specific individual after assessment.
```

---

### `INCOME_TAX_COMPANY` — Company Income Tax Return (ITF Company)

| | |
|---|---|
| **Legal basis** | Income Tax Order 1975 |
| **Who must file** | All companies, branches, and other corporate entities subject to Eswatini income tax. |
| **Form** | Annual income tax return — TaxEase electronic. |
| **Due date** | **Within 120 days of 30 June** (≈ 28 October). The most recent ERS Filing Season communication cites **31 October** as the deadline. Extension routinely granted for a further 60 days, effectively giving 6 months (≈ 30 December) — only if all prior-year tax requirements are up to date and provisional tax has been paid in accordance with the law. |
| **Period covered** | The tax year just ended. For 30 June 2026 year-end, the return for 2025/2026 tax year is due by 31 October 2026. |

**Auto-generation rules:**
```
Generate one entry per tax year:
  period_covered = e.g. "FY2025/2026"
  due_date = 31 October following the FY end (default)
  notes = "Extension to 30 December may be granted on request if prior-year compliance is current."
```

> **Non-standard year-ends.** PwC's text states the 120-day window is measured from 30 June regardless of the company's actual year-end. This is unusual and worth verifying with ERS for any client with a non-30-June year-end.

---

### `INCOME_TAX_INDIVIDUAL` — Individual Income Tax Return (ITF Individual)

| | |
|---|---|
| **Legal basis** | Income Tax Order 1975 |
| **Who must file** | Every person liable to taxation in a personal capacity (or representative). Exemption applies only where Final Deduction System (FDS) PAYE has covered all liability. |
| **Form** | TaxEase. |
| **Due date** | **30 November** for those with employment + other income. **31 October** for non-VAT registered entities (per ERS Filing Season campaign 2025). VAT-registered businesses and special groups: typically file by 31 December. |

**Auto-generation rules:**
```
Generate per-individual filings for the directors / contacts the practice files for:
  period_covered = e.g. "2025/2026"
  due_date = 30 November following the FY end (default for individual with mixed income)
```

---

### `WORKMENS_COMP` — Workman's Compensation Return of Earnings

| | |
|---|---|
| **Legal basis** | Workmen's Compensation Act |
| **Who must file** | Every employer. |
| **Calculation** | Annual premium calculated as (industry risk rate) × (total payroll). Industry rates are set by the Workmen's Compensation Commissioner. |
| **Due date** | Annual. The exact due date varies and is **not consistent across sources** — confirm against the specific client's last assessment letter from the Workmen's Compensation Commissioner. |
| **Form** | Return of Earnings form submitted to the Workmen's Compensation Commissioner (separate from ERS). |

**Auto-generation rules:**
```
IF company.paye_registered = TRUE (proxy for "has employees"):
  Generate one entry per year:
    due_date = ANNUAL_PLACEHOLDER (default to 31 March, EDITABLE)
    status = UPCOMING
    notes = "Confirm exact due date against last Commissioner's assessment letter."
```

---

### `TRADING_LICENSE_RENEWAL` — Annual Trading License Renewal

| | |
|---|---|
| **Legal basis** | Trading Licensing Order 1975 |
| **Who must file** | Every business operating in Eswatini. The license is issued by the Ministry of Commerce, Industry and Trade or the local municipality (Mbabane / Manzini / smaller town councils). Some sectors require additional sector-specific licenses. |
| **Renewal cadence** | Annual. |
| **Due date** | Per municipality and per license type — commonly aligned with the calendar year (renewal in January–March). **Always defer to the expiry date printed on the actual license certificate.** |

**Auto-generation rules:**
```
IF company.trading_license_expiry IS NOT NULL:
  Generate one renewal reminder entry:
    due_date = trading_license_expiry - 30 days
    notes = "Renew with [issuing municipality] before [trading_license_expiry]."
```

---

### `TAX_CLEARANCE_RENEWAL` — Tax Clearance Certificate (TCC)

| | |
|---|---|
| **Legal basis** | Income Tax Order 1975 (administrative practice) |
| **Issued by** | ERS, on application. Issued to taxpayers whose tax affairs are fully up to date — PAYE remittances, assessed taxes, all returns submitted, provisional tax paid, VAT returns and payments current. |
| **Required for** | Government tenders, large contracts, certain banking processes, transfer of property, and other administrative processes specified by counterparties. |
| **Validity** | Typically 12 months from date of issue. |
| **Due date** | No fixed national deadline — driven by external counterparty requirements (a bid invitation, a tender, a contract signing). |

**Auto-generation rules:**
```
IF company.tax_clearance_certificate_expiry IS NOT NULL:
  Generate one renewal reminder entry:
    due_date = tax_clearance_certificate_expiry - 30 days
    notes = "Verify all tax compliance current before applying. TCC requires PAYE/VAT/IT/Prov Tax all up to date."
```

---

### `AFS` — Annual Financial Statements (internal milestone)

| | |
|---|---|
| **Legal basis** | Companies Act 2009 (Eswatini) — preparation of annual accounts |
| **Who must file** | Every company is required to prepare annual financial statements. Whether they must be audited, reviewed, or simply prepared depends on the company's category under the Companies Act and any specific industry regulator. |
| **Submitted to** | The Registrar of Companies and tax purposes. ERS may request AFS in support of the tax return. |
| **Due date** | No standalone ERS deadline. AFS must typically be in place to prepare the income tax return, which means working back from the Income Tax due date. |

**Auto-generation rules:**
```
Generate one internal milestone per tax year:
  period_covered = e.g. "FY2025/2026"
  due_date = 30 September following FY end (default — gives one month buffer before INCOME_TAX_COMPANY due 31 October)
  notes = "Internal milestone. AFS must be ready before company income tax return."
```

---

### `INDEPENDENT_REVIEW` — Independent Review

| | |
|---|---|
| **Legal basis** | Companies Act 2009 (Eswatini) — review requirements per company category |
| **Who needs it** | Companies that fall below the audit threshold but above the unaudited compilation threshold (varies by Companies Act category and Public Interest Score equivalent). |
| **Performed by** | A registered accountant. |
| **Due date** | No standalone ERS deadline. Internal milestone tied to AFS. |

**Auto-generation rules:**
```
Do NOT auto-generate by default. Add manually for clients where independent review applies.
```

---

### `WHT_NON_RESIDENT` — Withholding Tax on payments to non-residents

| | |
|---|---|
| **Legal basis** | Income Tax Order 1975 |
| **Who must file** | Any Eswatini-resident payer who pays dividends, interest, royalties, or other applicable amounts to a non-resident. |
| **Standard rate** | **15%** on dividends and interest to non-residents. Reduced to **10%** under the South Africa double-taxation treaty for shareholders owning ≥25%. |
| **Due date** | Remit to ERS by the **7th day of the following month** (same convention as PAYE). |

**Auto-generation rules:**
```
Do NOT auto-generate by default. Add manually for clients with non-resident shareholder/lender exposure.
```

---

## DEACTIVATED / REPEALED filing types

These types exist as enum values for historical/backfill purposes but are NOT auto-generated for new tax years.

### `GRADED_TAX` — Graded Tax (Poll Tax) — REPEALED

| | |
|---|---|
| **Legal basis (historical)** | Graded Tax Act 1968 |
| **Status** | **REPEALED** by the Graded Tax (Repeal) Act 2023, effective **15 September 2023**. PAYE systems stopped automatically deducting the E18 annual amount from the start of the 2024/2025 tax year (July 2024). |
| **Historical rate** | E1.50 per month per employed person, payable in advance for the full year (E18.00) on 1 July. |
| **Source** | PaySpace announcement, 19 March 2025; references "Graded Tax (Repeal) Act 2023". |

> **Note on conflicting sources.** PwC's "Eswatini — Other Taxes" page (last reviewed 30 March 2026) still references the graded tax as if active. The PaySpace repeal notice is more specific and detailed. **Default behaviour:** treat Graded Tax as repealed and do NOT auto-generate. Verify with current ERS guidance if a client believes it still applies to them.

**Auto-generation rules:**
```
NEVER auto-generate GRADED_TAX entries. The type remains in the enum so historical periods (pre-15 September 2023) can be backfilled if needed.
```

---

## Things this document deliberately does NOT cover

- **Customs and excise** — out of scope for v1 of the CRM. Customs filings happen on import/export and are managed through ASYCUDAWorld, not TaxEase.
- **Transfer pricing returns** — out of scope for v1.
- **Country-by-Country (CbC) reporting** — out of scope for v1; affects multinationals only.
- **VAT-specific schedules** (VAT Schedule structure since 1 July 2023) — handled inside the VAT return itself, not as a separate filing.

If a client needs any of the above, log a manual entry rather than extending the auto-generation logic.

---

## Verification checklist (run when onboarding a new client)

For each new client added to the CRM:

- [ ] Confirm the company's **financial year-end** (default 30 June, but check)
- [ ] Confirm **TIN** matches the ERS-issued certificate
- [ ] Confirm **VAT registration status** and the **filing frequency** assigned (monthly / bi-monthly / quarterly) — read it off the VAT registration certificate
- [ ] Confirm **PAYE registration status** — does the company have employees?
- [ ] Confirm **Provisional Tax** registration — most companies are; some sole props are not
- [ ] Confirm **Trading License** number, expiry date, and issuing municipality
- [ ] Confirm **TCC** expiry (if held)
- [ ] Confirm **Workmen's Compensation** assessment letter and due date
- [ ] Run "Generate annual schedule" action — review the generated filings against the client's actual ERS letters
- [ ] Adjust any defaults that don't match (override at the per-filing level, NOT by editing this reference)

If you find a systemic difference (e.g. a whole class of clients has different VAT due dates), update this reference document, then regenerate.

---

## Sources

- **Eswatini Revenue Service** — [ers.org.sz](https://www.ers.org.sz). Authoritative for current forms, frequencies, and TaxEase submission rules.
- **PwC Worldwide Tax Summaries — Eswatini** — [taxsummaries.pwc.com/eswatini](https://taxsummaries.pwc.com/eswatini). Tax administration pages for corporate and individual, last reviewed 30 March 2026.
- **PaySpace Knowledge Base — Eswatini** — payroll-provider commentary on Monthly PAYE Schedule changes (effective 1 July 2024) and Graded Tax repeal (effective 15 September 2023).
- **Income Tax Order 1975** — primary legislation governing income tax, PAYE, provisional tax, and withholding tax.
- **VAT Act 2011 + VAT Regulations** — primary legislation governing VAT.
- **Companies Act 2009 (Eswatini)** — governs entity types, AFS preparation, and review/audit thresholds.
- **Graded Tax (Repeal) Act 2023** — repealed the Graded Tax Act 1968 effective 15 September 2023.

> **Source of truth.** Where this document conflicts with an ERS letter received by a specific client, **the ERS letter wins** for that client. Override the default at the filing level, leave this document unchanged, and add a note on the client's company record explaining the deviation.

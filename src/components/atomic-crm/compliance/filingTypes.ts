import type { FilingStatus, FilingType } from "../types";

export const FILING_TYPE_LABELS: Record<FilingType, string> = {
  VAT_RETURN: "VAT Return",
  PAYE_RETURN: "PAYE Return",
  PROV_TAX_FIRST: "Provisional Tax (1st Instalment)",
  PROV_TAX_SECOND: "Provisional Tax (2nd Instalment)",
  PROV_TAX_TOPUP: "Provisional Tax Top-Up",
  INCOME_TAX_COMPANY: "Company Income Tax Return",
  INCOME_TAX_INDIVIDUAL: "Individual Income Tax Return",
  WORKMENS_COMP: "Workman's Compensation",
  TRADING_LICENSE_RENEWAL: "Trading License Renewal",
  TAX_CLEARANCE_RENEWAL: "Tax Clearance Certificate Renewal",
  WHT_NON_RESIDENT: "WHT — Non-Resident Payments",
  AFS: "Annual Financial Statements",
  INDEPENDENT_REVIEW: "Independent Review",
  GRADED_TAX: "Graded Tax (Repealed)",
};

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  UPCOMING: "Upcoming",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  OVERDUE: "Overdue",
};

export const FILING_STATUS_COLORS: Record<FilingStatus, string> = {
  UPCOMING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  IN_PROGRESS:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  SUBMITTED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const ALL_FILING_STATUSES: FilingStatus[] = [
  "UPCOMING",
  "IN_PROGRESS",
  "SUBMITTED",
  "OVERDUE",
];

export const ALL_FILING_TYPES: FilingType[] = [
  "VAT_RETURN",
  "PAYE_RETURN",
  "PROV_TAX_FIRST",
  "PROV_TAX_SECOND",
  "INCOME_TAX_COMPANY",
  "WORKMENS_COMP",
  "TRADING_LICENSE_RENEWAL",
  "TAX_CLEARANCE_RENEWAL",
  "AFS",
  "PROV_TAX_TOPUP",
  "INCOME_TAX_INDIVIDUAL",
  "WHT_NON_RESIDENT",
  "INDEPENDENT_REVIEW",
];

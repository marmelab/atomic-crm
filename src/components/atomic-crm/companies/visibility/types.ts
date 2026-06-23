import type { DataProvider, Identifier } from "ra-core";
import type { ReportAiContent } from "../../types";

export type VisibilityDataProvider = DataProvider & {
  analyzeWebsite(
    companyId: Identifier,
    options?: {
      window_kind?: "rolling_28d" | "calendar_month";
      start_date?: string;
      end_date?: string;
    },
  ): Promise<{
    success: true;
    snapshot_id: number;
    findings_count: number;
  }>;
  generateMonthlyReport(
    companyId: Identifier,
  ): Promise<{ success: true; report_id: number | null; status: string }>;
  sendMonthlyReport(
    reportId: Identifier,
    overrides?: {
      recipient_email?: string;
      recipient_name?: string;
      ai_content?: ReportAiContent;
    },
  ): Promise<{
    success: true;
    report_id: number;
    status: string;
    email_send_id: number | null;
  }>;
  getMonthlyReportPdf(
    reportId: Identifier,
  ): Promise<{ success: true; signed_url: string; expires_in: number }>;
};

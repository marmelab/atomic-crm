import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  errorResponseFromUnknown,
  getPositiveIntegerField,
  parseRequiredJsonBody,
} from "../_shared/http.ts";
import { createErrorResponse, createJsonResponse } from "../_shared/utils.ts";

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async () => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }
        try {
          const body = await parseRequiredJsonBody(req);
          const reportId = getPositiveIntegerField(body, "report_id", {
            required: true,
          });
          const { data: report, error } = await supabaseAdmin
            .from("monthly_reports")
            .select("pdf_storage_path")
            .eq("id", reportId)
            .single();
          if (error || !report?.pdf_storage_path) {
            return createErrorResponse(404, "Report PDF not found");
          }
          const { data, error: signError } = await supabaseAdmin.storage
            .from("monthly-reports")
            .createSignedUrl(report.pdf_storage_path, 60 * 10);
          if (signError || !data?.signedUrl) {
            throw new Error(`Could not sign report PDF: ${signError?.message}`);
          }
          return createJsonResponse({
            success: true,
            signed_url: data.signedUrl,
            expires_in: 600,
          });
        } catch (error) {
          return errorResponseFromUnknown(error);
        }
      }),
    ),
  ),
);

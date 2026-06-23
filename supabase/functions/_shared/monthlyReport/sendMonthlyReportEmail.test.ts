import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMonthlyReportEmail } from "./sendMonthlyReportEmail.ts";

describe("sendMonthlyReportEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends a PDF attachment to Resend as base64", async () => {
    vi.stubGlobal("Deno", {
      env: {
        get: (key: string) =>
          key === "RESEND_API_KEY"
            ? "re_test"
            : key === "RESEND_FROM_EMAIL"
              ? "hej@axonadigital.se"
              : undefined,
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const supabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 99 }, error: null }),
          }),
        }),
      }),
    };

    const result = await sendMonthlyReportEmail({
      supabase,
      monthlyReportId: 7,
      companyId: 3,
      toEmail: "kund@example.com",
      subject: "Majrapport",
      html: "<p>Rapport</p>",
      bodyPreview: "Rapport",
      period: "2026-05-01",
      attachment: {
        filename: "rapport.pdf",
        content: new Uint8Array([1, 2, 3, 4]),
      },
    });

    expect(result.emailSendId).toBe(99);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.attachments).toEqual([
      {
        filename: "rapport.pdf",
        content: "AQIDBA==",
        content_type: "application/pdf",
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  docuSealOutgoingPayloadSchema,
  docuSealWebhookPayloadSchema,
  generatedSectionsSchema,
  saveQuoteContentPayloadSchema,
  saveQuoteEditsPayloadSchema,
} from "./schemas.ts";

describe("generatedSectionsSchema", () => {
  it("accepts the minimal required fields", () => {
    const parsed = generatedSectionsSchema.safeParse({
      summary_pitch: "A compelling one-liner",
      proposal_body: "The full proposal body that the seller will see.",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts extra passthrough fields so section evolution stays easy", () => {
    const parsed = generatedSectionsSchema.safeParse({
      summary_pitch: "x",
      proposal_body: "y",
      package_includes: ["Design", "Build"],
      upgrade_package: { title: "Premium", price: "Offert" },
      future_new_field: 123,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty summary_pitch", () => {
    const parsed = generatedSectionsSchema.safeParse({
      summary_pitch: "",
      proposal_body: "y",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects missing proposal_body", () => {
    const parsed = generatedSectionsSchema.safeParse({
      summary_pitch: "x",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-string summary_pitch", () => {
    const parsed = generatedSectionsSchema.safeParse({
      summary_pitch: 123,
      proposal_body: "y",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("saveQuoteContentPayloadSchema", () => {
  it("accepts a valid payload with a numeric quote_id", () => {
    const parsed = saveQuoteContentPayloadSchema.safeParse({
      quote_id: 42,
      sections: { summary_pitch: "x" },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a string quote_id (legacy CRM calls)", () => {
    const parsed = saveQuoteContentPayloadSchema.safeParse({
      quote_id: "42",
      sections: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects when sections is null", () => {
    const parsed = saveQuoteContentPayloadSchema.safeParse({
      quote_id: 42,
      sections: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects when sections is an array", () => {
    const parsed = saveQuoteContentPayloadSchema.safeParse({
      quote_id: 42,
      sections: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects when quote_id is zero", () => {
    const parsed = saveQuoteContentPayloadSchema.safeParse({
      quote_id: 0,
      sections: {},
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects when quote_id is missing", () => {
    const parsed = saveQuoteContentPayloadSchema.safeParse({
      sections: {},
    });
    expect(parsed.success).toBe(false);
  });
});

describe("saveQuoteEditsPayloadSchema", () => {
  it("accepts a valid payload with a write_token", () => {
    const parsed = saveQuoteEditsPayloadSchema.safeParse({
      quote_id: 42,
      write_token: "abcdef-uuid-string",
      sections: { summary_pitch: "x" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing write_token", () => {
    const parsed = saveQuoteEditsPayloadSchema.safeParse({
      quote_id: 42,
      sections: {},
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty write_token", () => {
    const parsed = saveQuoteEditsPayloadSchema.safeParse({
      quote_id: 42,
      write_token: "",
      sections: {},
    });
    expect(parsed.success).toBe(false);
  });
});

describe("docuSealWebhookPayloadSchema", () => {
  it("accepts a form.completed payload with nested submission", () => {
    const parsed = docuSealWebhookPayloadSchema.safeParse({
      event_type: "form.completed",
      data: {
        submission: {
          id: 12345,
          status: "completed",
          combined_document_url: "https://example.com/doc.pdf",
        },
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a form.declined payload where combined_document_url is null (DocuSeal CE)", () => {
    // DocuSeal CE sends null for combined_document_url when no document has been produced yet
    // (e.g. form.viewed, form.declined). This was previously quarantined because
    // z.string().optional() rejects explicit null values.
    const parsed = docuSealWebhookPayloadSchema.safeParse({
      event_type: "form.declined",
      data: {
        submission: {
          id: 39,
          status: "declined",
          combined_document_url: null,
        },
        status: "declined",
        declined_at: "2026-04-15T16:20:34.400Z",
        submission_id: 39,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a submission.viewed payload with top-level submission_id", () => {
    const parsed = docuSealWebhookPayloadSchema.safeParse({
      type: "submission.viewed",
      submission_id: "uuid-123",
      data: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("passes through fields we don't explicitly model", () => {
    const parsed = docuSealWebhookPayloadSchema.safeParse({
      event_type: "form.viewed",
      data: {
        submission: { id: 1, status: "pending" },
        extra_nested: { and_more: true },
      },
      unrelated_top_level: "tag",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects payloads with neither event_type nor type", () => {
    const parsed = docuSealWebhookPayloadSchema.safeParse({
      data: { submission: { id: 1 } },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-object payloads", () => {
    expect(docuSealWebhookPayloadSchema.safeParse("string").success).toBe(
      false,
    );
    expect(docuSealWebhookPayloadSchema.safeParse(null).success).toBe(false);
    expect(docuSealWebhookPayloadSchema.safeParse(42).success).toBe(false);
  });
});

describe("docuSealOutgoingPayloadSchema", () => {
  function makeValidPayload() {
    return {
      template_id: 42,
      send_email: false,
      order: "preserved",
      submitters: [
        {
          role: "Axona Digital AB",
          email: "info@axonadigital.se",
          name: "Rasmus Jönsson",
          completed: true,
          send_email: false,
          fields: [
            {
              name: "Axona signatur",
              default_value: "Rasmus Jönsson",
              readonly: true,
            },
          ],
        },
        {
          role: "First Party",
          email: "kund@exempel.se",
          name: "Kund Kundsson",
          send_email: false,
          fields: [
            { name: "Datum", default_value: "2026-04-15", readonly: true },
          ],
        },
      ],
    };
  }

  it("accepts the canonical payload shape buildSubmissionPayload produces", () => {
    const parsed = docuSealOutgoingPayloadSchema.safeParse(makeValidPayload());
    expect(parsed.success).toBe(true);
  });

  it("rejects missing template_id", () => {
    const payload = makeValidPayload() as Partial<
      ReturnType<typeof makeValidPayload>
    >;
    delete (payload as { template_id?: number }).template_id;
    const parsed = docuSealOutgoingPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty submitters array", () => {
    const payload = makeValidPayload();
    payload.submitters = [];
    const parsed = docuSealOutgoingPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects a submitter with invalid email", () => {
    const payload = makeValidPayload();
    payload.submitters[1].email = "not-an-email";
    const parsed = docuSealOutgoingPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects a submitter with empty role", () => {
    const payload = makeValidPayload();
    payload.submitters[0].role = "";
    const parsed = docuSealOutgoingPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects a field with non-boolean readonly", () => {
    const payload = makeValidPayload();
    (payload.submitters[0].fields[0] as { readonly: unknown }).readonly = "yes";
    const parsed = docuSealOutgoingPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  // Strictness regression tests — these lock the fix for Codex phase 3
  // review finding 1. Without .strict() Zod silently strips unknown keys
  // instead of rejecting, so a future edit to buildSubmissionPayload
  // adding a typo or experimental field could slip past the schema.

  it("rejects an unknown top-level key (strict)", () => {
    const payload = {
      ...makeValidPayload(),
      typo_field: "should fail",
    };
    const parsed = docuSealOutgoingPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown key on a submitter (strict)", () => {
    const payload = makeValidPayload();
    (payload.submitters[0] as Record<string, unknown>).extra_submitter_prop =
      "nope";
    const parsed = docuSealOutgoingPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown key on a submitter field (strict)", () => {
    const payload = makeValidPayload();
    (payload.submitters[0].fields[0] as Record<string, unknown>).extra_field =
      "nope";
    const parsed = docuSealOutgoingPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });
});

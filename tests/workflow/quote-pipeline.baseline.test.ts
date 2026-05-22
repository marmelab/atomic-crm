/**
 * Phase 0 behavioral baseline for the quote workflow refactor.
 *
 * These tests freeze the current observable behavior of the extractable
 * parts of the quote pipeline. Phases 1 and 2 must not change any of the
 * recorded outputs without an explicit update to the baseline snapshots.
 *
 * Run with:
 *   npm run test:workflow              # verify against frozen baseline
 *   npm run test:workflow:update       # regenerate baseline
 *
 * Scope:
 *  1. AI response parsing (regex currently duplicated in orchestrate_proposal
 *     and generate_quote_text) — must produce same generated_sections shape
 *     after Phase 1 extraction.
 *  2. DocuSeal submission payload (buildSubmissionPayload from contractFields)
 *     — must produce same canonicalized payload after Phase 2 centralization
 *     into createSigningSubmission.
 *  3. proposal_body extraction — the text fallback both edge functions derive
 *     from parsed sections must remain identical.
 *
 * Deliberate deviation from Codex spec: this baseline uses in-process pure
 * function tests instead of a full local-Supabase HTTP mock harness. The
 * refactor touches shared helpers, so parity at the helper level is the
 * right granularity. If a later phase changes orchestration HTTP shape,
 * we add a handler-level test at that time.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSubmissionPayload } from "../../supabase/functions/_shared/contractFields.ts";
import { parseAnthropicSections } from "../../supabase/functions/_shared/quoteWorkflow/generateSections.ts";
import {
  buildSigningPayload,
  createSigningSubmission,
  type CreateSigningSubmissionInput,
} from "../../supabase/functions/_shared/quoteWorkflow/createSigningSubmission.ts";
import { stripWriteTokenFromHtml } from "../../supabase/functions/_shared/sanitizeQuoteHtml.ts";
import { parseAnthropicResponseCurrentBehavior } from "./helpers/parseAnthropicCurrentBehavior.ts";
import {
  canonicalizeDocuSealPayload,
  extractShape,
} from "./helpers/canonicalize.ts";

const FIXTURES = resolve(__dirname, "fixtures");
const BASELINE = resolve(__dirname, "baseline");

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), "utf-8");
}

function loadJsonFixture<T>(name: string): T {
  return JSON.parse(loadFixture(name)) as T;
}

describe("Phase 0 baseline: AI response parsing", () => {
  const rawAnthropicResponse = loadFixture("anthropic-response.txt");

  it("parses fixture into generated_sections with stable shape", async () => {
    const result = parseAnthropicResponseCurrentBehavior(rawAnthropicResponse);

    expect(result.generatedSections).not.toBeNull();

    const shape = extractShape(result.generatedSections);
    await expect(JSON.stringify(shape, null, 2)).toMatchFileSnapshot(
      resolve(BASELINE, "generated-sections.shape.json"),
    );
  });

  it("extracts proposal_body as plain text fallback", async () => {
    const result = parseAnthropicResponseCurrentBehavior(rawAnthropicResponse);

    expect(result.generatedText).not.toBe(rawAnthropicResponse);
    expect(result.generatedText.length).toBeGreaterThan(100);
    await expect(result.generatedText).toMatchFileSnapshot(
      resolve(BASELINE, "proposal-body.txt"),
    );
  });

  it("returns null sections when JSON block is absent", () => {
    const result = parseAnthropicResponseCurrentBehavior(
      "Bara fri text utan JSON-struktur alls.",
    );
    expect(result.generatedSections).toBeNull();
    expect(result.generatedText).toBe("Bara fri text utan JSON-struktur alls.");
  });

  it("returns null sections when JSON is malformed", () => {
    const malformed =
      'Texten innehåller { "summary_pitch": "x", "proposal_body": broken }';
    const result = parseAnthropicResponseCurrentBehavior(malformed);
    expect(result.generatedSections).toBeNull();
    expect(result.generatedText).toBe(malformed);
  });
});

describe("Phase 1 parity: extracted parseAnthropicSections matches legacy", () => {
  const rawAnthropicResponse = loadFixture("anthropic-response.txt");

  it("extracted helper produces identical sections for fixture", () => {
    const legacy = parseAnthropicResponseCurrentBehavior(rawAnthropicResponse);
    const extracted = parseAnthropicSections(rawAnthropicResponse);

    expect(extracted.generatedSections).toEqual(legacy.generatedSections);
    expect(extracted.generatedText).toBe(legacy.generatedText);
  });

  it("extracted helper produces null for plain text input", () => {
    const raw = "Bara fri text utan JSON-struktur alls.";
    const legacy = parseAnthropicResponseCurrentBehavior(raw);
    const extracted = parseAnthropicSections(raw);

    expect(extracted.generatedSections).toBeNull();
    expect(extracted.generatedSections).toEqual(legacy.generatedSections);
    expect(extracted.generatedText).toBe(legacy.generatedText);
  });

  it("extracted helper falls back to raw text on malformed JSON", () => {
    const malformed =
      'Texten innehåller { "summary_pitch": "x", "proposal_body": broken }';
    const legacy = parseAnthropicResponseCurrentBehavior(malformed);
    const extracted = parseAnthropicSections(malformed);

    expect(extracted.generatedSections).toBeNull();
    expect(extracted.generatedSections).toEqual(legacy.generatedSections);
    expect(extracted.generatedText).toBe(legacy.generatedText);
  });
});

describe("Phase 0 baseline: DocuSeal submission payload", () => {
  type ContractInputFixture = Parameters<typeof buildSubmissionPayload>[0];

  it("builds payload from canonical quote fixture", async () => {
    const input = loadJsonFixture<ContractInputFixture>("contract-input.json");
    const payload = buildSubmissionPayload(input);
    const canonical = canonicalizeDocuSealPayload(payload);

    await expect(JSON.stringify(canonical, null, 2)).toMatchFileSnapshot(
      resolve(BASELINE, "docuseal-payload.json"),
    );
  });

  it("preserves submitter order (Axona Digital AB first, First Party second)", () => {
    const input = loadJsonFixture<ContractInputFixture>("contract-input.json");
    const payload = buildSubmissionPayload(input);

    expect(payload.submitters).toHaveLength(2);
    expect(payload.submitters[0].role).toBe("Axona Digital AB");
    expect(payload.submitters[1].role).toBe("First Party");
  });

  it("never sets send_email=true on submitters (we send via Resend ourselves)", () => {
    const input = loadJsonFixture<ContractInputFixture>("contract-input.json");
    const payload = buildSubmissionPayload(input);

    expect(payload.send_email).toBe(false);
    for (const submitter of payload.submitters) {
      expect(submitter.send_email).toBe(false);
    }
  });

  it("includes proposal link field when proposalUrl is provided", () => {
    const input = loadJsonFixture<ContractInputFixture>("contract-input.json");
    const payload = buildSubmissionPayload(input);
    const clientFields = payload.submitters[1].fields;
    const proposalLink = clientFields.find((f) => f.name === "Offertlänk");

    expect(proposalLink).toBeDefined();
    expect(proposalLink?.default_value).toContain("quote.html");
  });

  it("omits proposal link field when proposalUrl is absent", () => {
    const input = loadJsonFixture<ContractInputFixture>("contract-input.json");
    const withoutUrl = { ...input, proposalUrl: undefined };
    const payload = buildSubmissionPayload(withoutUrl);
    const clientFields = payload.submitters[1].fields;

    expect(clientFields.find((f) => f.name === "Offertlänk")).toBeUndefined();
  });
});

describe("Phase 2 parity: createSigningSubmission from both callers", () => {
  type ContractInputFixture = Parameters<typeof buildSubmissionPayload>[0];

  /**
   * Build a createSigningSubmission input from the shared contract fixture,
   * mirroring what each edge function assembles today. Keep the shape of
   * this helper in sync with send_quote_for_signing/index.ts and
   * approve_proposal/index.ts — if they diverge, this test catches it.
   */
  function buildSigningInput(
    initiator: CreateSigningSubmissionInput["initiator"],
    overrides: Partial<CreateSigningSubmissionInput> = {},
  ): CreateSigningSubmissionInput {
    const fixture = loadJsonFixture<ContractInputFixture>(
      "contract-input.json",
    );
    return {
      supabase: {
        from: () => ({
          update: () => ({
            eq: async () => ({ data: null, error: null }),
          }),
        }),
      } as unknown as CreateSigningSubmissionInput["supabase"],
      initiator,
      quote: {
        id: fixture.quote.id,
        quote_number: fixture.quote.quote_number,
        valid_until: fixture.quote.valid_until,
        total_amount: fixture.quote.total_amount,
        subtotal: fixture.quote.subtotal,
        vat_amount: fixture.quote.vat_amount,
        vat_rate: fixture.quote.vat_rate,
        payment_terms: fixture.quote.payment_terms,
        delivery_terms: fixture.quote.delivery_terms,
        terms_and_conditions: fixture.quote.terms_and_conditions,
        generated_text: fixture.quote.generated_text,
        currency: fixture.quote.currency,
      },
      company: fixture.company,
      contact: fixture.contact,
      lineItems: fixture.lineItems,
      proposalUrl: fixture.proposalUrl!,
      docusealApiKey: "test-api-key",
      docusealTemplateId: fixture.templateId,
      docusealBaseUrl: "https://test-docuseal.local",
      now: () => new Date("2026-04-15T10:00:00.000Z"),
      ...overrides,
    };
  }

  it("CRM manual path and Discord approval path build identical DocuSeal payloads", () => {
    const manualInput = buildSigningInput({ source: "crm_manual" });
    const approvalInput = buildSigningInput({ source: "discord_approval" });

    const manualPayload = buildSigningPayload(manualInput);
    const approvalPayload = buildSigningPayload(approvalInput);

    // The payload must not depend on which path triggered it.
    expect(manualPayload).toEqual(approvalPayload);
  });

  it("builds a payload byte-identical to the Phase 0 baseline snapshot", async () => {
    const input = buildSigningInput({ source: "crm_manual" });
    const payload = buildSigningPayload(input);
    const canonical = canonicalizeDocuSealPayload(payload);

    await expect(JSON.stringify(canonical, null, 2)).toMatchFileSnapshot(
      resolve(BASELINE, "docuseal-payload.json"),
    );
  });

  it("idempotence: reuses existing submission for sent/viewed after DocuSeal verification", async () => {
    for (const status of ["sent", "viewed"]) {
      let fetchCalls = 0;
      const input = buildSigningInput(
        { source: "crm_manual" },
        {
          quote: {
            ...buildSigningInput({ source: "crm_manual" }).quote,
            docuseal_submission_id: "existing-submission-42",
            docuseal_signing_url: "https://test-docuseal.local/s/existing",
            status,
          },
          fetchImpl: async () => {
            fetchCalls += 1;
            return new Response(
              JSON.stringify({
                id: "existing-submission-42",
                submitters: [
                  { slug: "axona" },
                  { slug: "existing" },
                ],
              }),
              {
                status: 200,
                headers: { "content-type": "application/json" },
              },
            );
          },
        },
      );

      const result = await createSigningSubmission(input);

      expect(fetchCalls).toBe(1);
      expect(result.reusedExistingSubmission).toBe(true);
      expect(result.shouldSendSigningEmail).toBe(true);
      expect(result.submissionId).toBe("existing-submission-42");
      expect(result.signingUrl).toBe("https://test-docuseal.local/s/existing");
    }
  });

  it("idempotence: reuses signed submissions without contacting DocuSeal", async () => {
    const input = buildSigningInput(
      { source: "crm_manual" },
      {
        quote: {
          ...buildSigningInput({ source: "crm_manual" }).quote,
          docuseal_submission_id: "existing-submission-42",
          docuseal_signing_url: "https://test-docuseal.local/s/existing",
          status: "signed",
        },
        fetchImpl: async () => {
          throw new Error(
            "fetch should NOT be called when reusing a signed submission",
          );
        },
      },
    );

    const result = await createSigningSubmission(input);

    expect(result.reusedExistingSubmission).toBe(true);
    expect(result.shouldSendSigningEmail).toBe(false);
    expect(result.submissionId).toBe("existing-submission-42");
    expect(result.signingUrl).toBe("https://test-docuseal.local/s/existing");
  });

  it("idempotence: creates a new submission when no submission_id exists", async () => {
    let fetchCalls = 0;
    const input = buildSigningInput(
      { source: "crm_manual" },
      {
        fetchImpl: async () => {
          fetchCalls += 1;
          return new Response(
            JSON.stringify([
              { submission_id: "new-sub-99", slug: "axona-slug" },
              { submission_id: "new-sub-99", slug: "customer-slug" },
            ]),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        },
      },
    );

    const result = await createSigningSubmission(input);

    expect(fetchCalls).toBe(1);
    expect(result.reusedExistingSubmission).toBe(false);
    expect(result.submissionId).toBe("new-sub-99");
    expect(result.signingUrl).toBe(
      "https://test-docuseal.local/s/customer-slug",
    );
  });

  it("approval path sets approved_at in the quote update", async () => {
    const recordedUpdates: Record<string, unknown>[] = [];
    const supabaseStub = {
      from: () => ({
        update: (values: Record<string, unknown>) => {
          recordedUpdates.push(values);
          return {
            eq: async () => ({ data: null, error: null }),
          };
        },
      }),
    };

    const input = buildSigningInput(
      { source: "discord_approval" },
      {
        supabase:
          supabaseStub as unknown as CreateSigningSubmissionInput["supabase"],
        fetchImpl: async () =>
          new Response(
            JSON.stringify([
              { submission_id: "sub-approval", slug: "axona" },
              { submission_id: "sub-approval", slug: "customer" },
            ]),
            { status: 200 },
          ),
      },
    );

    await createSigningSubmission(input);

    expect(recordedUpdates).toHaveLength(1);
    expect(recordedUpdates[0].approved_at).toBeDefined();
    expect(recordedUpdates[0].sent_at).toBeDefined();
    expect(recordedUpdates[0].status).toBe("sent");
  });

  it("manual path does NOT set approved_at in the quote update", async () => {
    const recordedUpdates: Record<string, unknown>[] = [];
    const supabaseStub = {
      from: () => ({
        update: (values: Record<string, unknown>) => {
          recordedUpdates.push(values);
          return {
            eq: async () => ({ data: null, error: null }),
          };
        },
      }),
    };

    const input = buildSigningInput(
      { source: "crm_manual" },
      {
        supabase:
          supabaseStub as unknown as CreateSigningSubmissionInput["supabase"],
        fetchImpl: async () =>
          new Response(
            JSON.stringify([
              { submission_id: "sub-manual", slug: "axona" },
              { submission_id: "sub-manual", slug: "customer" },
            ]),
            { status: 200 },
          ),
      },
    );

    await createSigningSubmission(input);

    expect(recordedUpdates).toHaveLength(1);
    expect(recordedUpdates[0].approved_at).toBeUndefined();
    expect(recordedUpdates[0].sent_at).toBeDefined();
  });
});

describe("Hotfix regression: public quote HTML must not leak write token", () => {
  // Simulates the two HTML artifacts generate_quote_pdf produces after the
  // finding-1 fix: the editable variant that lives in quotes.html_content
  // (may carry the real token) and the public variant that gets uploaded
  // to Supabase Storage and served via pdf_url (MUST NOT carry the token).
  //
  // These tests lock the invariant down at the unit level so that a future
  // edit to generate_quote_pdf cannot silently reintroduce the leak that
  // Codex caught during the phase 2 post-deploy review.
  const realToken = "4b7f8c2e-1a9d-4f0b-8e6c-3d2a5f1c9e8b";

  function buildEditableFixture(): string {
    return [
      "<!DOCTYPE html>",
      "<html>",
      "<head><title>Offert 42</title></head>",
      "<body>",
      "<h1>Offert</h1>",
      "<script>",
      `window.QUOTE_WRITE_TOKEN="${realToken}";`,
      "initEditor();",
      "</script>",
      "</body>",
      "</html>",
    ].join("\n");
  }

  it("editable variant carries the real token (internal CRM preview needs it)", () => {
    const editable = buildEditableFixture();
    expect(editable).toContain(realToken);
    expect(editable).toContain(`window.QUOTE_WRITE_TOKEN="${realToken}";`);
  });

  it("public variant is derived by stripWriteTokenFromHtml and carries no token", () => {
    const editable = buildEditableFixture();
    const publicHtml = stripWriteTokenFromHtml(editable);

    expect(publicHtml).not.toContain(realToken);
    expect(publicHtml).toContain('window.QUOTE_WRITE_TOKEN = "";');
  });

  it("public variant preserves surrounding HTML and script behavior hooks", () => {
    const editable = buildEditableFixture();
    const publicHtml = stripWriteTokenFromHtml(editable);

    // Structure should be intact — only the token assignment is rewritten.
    expect(publicHtml).toContain("<!DOCTYPE html>");
    expect(publicHtml).toContain("<title>Offert 42</title>");
    expect(publicHtml).toContain("<h1>Offert</h1>");
    expect(publicHtml).toContain("initEditor();");
  });

  it("public variant with a UUID-shaped token matches the same invariant", () => {
    // Uses a different shape than the fixture to guard against accidental
    // hardcoding of the fixture value in the implementation.
    const anotherUuid = "00000000-aaaa-bbbb-cccc-111122223333";
    const editable = `<script>window.QUOTE_WRITE_TOKEN="${anotherUuid}";</script>`;
    const publicHtml = stripWriteTokenFromHtml(editable);

    expect(publicHtml).not.toContain(anotherUuid);
    expect(publicHtml).toContain('window.QUOTE_WRITE_TOKEN = "";');
  });

  it("is idempotent — running strip twice yields the same output", () => {
    const editable = buildEditableFixture();
    const once = stripWriteTokenFromHtml(editable);
    const twice = stripWriteTokenFromHtml(once);
    expect(twice).toBe(once);
  });
});

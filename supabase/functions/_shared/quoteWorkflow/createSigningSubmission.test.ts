import { describe, expect, it, vi } from "vitest";

import {
  createSigningSubmission,
  type CreateSigningSubmissionInput,
} from "./createSigningSubmission.ts";

function buildSigningInput(
  initiator: CreateSigningSubmissionInput["initiator"] = { source: "crm_manual" },
  overrides: Partial<CreateSigningSubmissionInput> = {},
): CreateSigningSubmissionInput {
  const updateCalls: Array<Record<string, unknown>> = [];
  const supabase = {
    from: () => ({
      update: (values: Record<string, unknown>) => {
        updateCalls.push(values);
        return {
          eq: async () => ({ data: null, error: null }),
        };
      },
    }),
  } as unknown as CreateSigningSubmissionInput["supabase"];

  return {
    supabase,
    initiator,
    quote: {
      id: 42,
      quote_number: "2026-0042",
      valid_until: "2026-05-15",
      total_amount: 12500,
      subtotal: 10000,
      vat_amount: 2500,
      vat_rate: 25,
      payment_terms: "30 dagar",
      delivery_terms: "Digital leverans",
      terms_and_conditions: "Standardvillkor",
      generated_text: "Generated text",
      currency: "SEK",
      status: "generated",
    },
    company: { name: "Axona Test AB", org_number: "556677-8899" },
    contact: { name: "Ada Lovelace", email: "ada@example.com" },
    lineItems: [
      {
        description: "Implementation",
        quantity: 1,
        unit_price: 10000,
        total: 10000,
      },
    ],
    proposalUrl: "https://crm.axona.test/quote.html?id=42&token=abc",
    docusealApiKey: "docuseal-key",
    docusealTemplateId: 7,
    docusealBaseUrl: "https://test-docuseal.local",
    now: () => new Date("2026-04-15T10:00:00.000Z"),
    ...overrides,
  };
}

describe("createSigningSubmission", () => {
  it("throws 409 when the quote is declined", async () => {
    const input = buildSigningInput(
      { source: "crm_manual" },
      {
        quote: {
          ...buildSigningInput().quote,
          status: "declined",
          docuseal_submission_id: "declined-sub",
        },
      },
    );

    await expect(createSigningSubmission(input)).rejects.toMatchObject({
      name: "DocuSealSubmissionError",
      status: 409,
    });
  });

  it("reuses a sent submission after verifying it still exists in DocuSeal", async () => {
    let fetchCalls = 0;
    const input = buildSigningInput(
      { source: "crm_manual" },
      {
        quote: {
          ...buildSigningInput().quote,
          status: "sent",
          docuseal_submission_id: "existing-sub-42",
          docuseal_signing_url: "https://test-docuseal.local/s/existing",
        },
        fetchImpl: async () => {
          fetchCalls += 1;
          return new Response(
            JSON.stringify({
              id: "existing-sub-42",
              submitters: [
                { slug: "axona" },
                { slug: "existing" },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        },
      },
    );

    const result = await createSigningSubmission(input);

    expect(fetchCalls).toBe(1);
    expect(result.reusedExistingSubmission).toBe(true);
    expect(result.shouldSendSigningEmail).toBe(true);
    expect(result.signingUrl).toBe("https://test-docuseal.local/s/existing");
  });

  it("recreates a phantom submission when DocuSeal returns 404", async () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    let fetchCalls = 0;
    const supabase = {
      from: () => ({
        update: (values: Record<string, unknown>) => {
          updateCalls.push(values);
          return {
            eq: async () => ({ data: null, error: null }),
          };
        },
      }),
    } as unknown as CreateSigningSubmissionInput["supabase"];

    const input = buildSigningInput(
      { source: "crm_manual" },
      {
        supabase,
        quote: {
          ...buildSigningInput().quote,
          status: "sent",
          docuseal_submission_id: "phantom-sub-42",
          docuseal_signing_url: "https://test-docuseal.local/s/phantom",
        },
        fetchImpl: async (_url, init) => {
          fetchCalls += 1;
          if (init?.method === "GET") {
            return new Response("missing", { status: 404 });
          }
          return new Response(
            JSON.stringify([
              { submission_id: "new-sub-42", slug: "axona" },
              { submission_id: "new-sub-42", slug: "customer" },
            ]),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        },
      },
    );

    const result = await createSigningSubmission(input);

    expect(fetchCalls).toBe(2);
    expect(updateCalls[0]).toEqual({
      docuseal_submission_id: null,
      docuseal_signing_url: null,
    });
    expect(updateCalls[1]).toMatchObject({
      docuseal_submission_id: "new-sub-42",
      docuseal_signing_url: "https://test-docuseal.local/s/customer",
      status: "sent",
    });
    expect(result.reusedExistingSubmission).toBe(false);
    expect(result.shouldSendSigningEmail).toBe(true);
    expect(result.submissionId).toBe("new-sub-42");
  });

  it("recovers a generated quote that already has a live DocuSeal submission", async () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    const snapshotFn = vi.fn(async () => {});
    const supabase = {
      from: () => ({
        update: (values: Record<string, unknown>) => {
          updateCalls.push(values);
          return {
            eq: async () => ({ data: null, error: null }),
          };
        },
      }),
    } as unknown as CreateSigningSubmissionInput["supabase"];

    const input = buildSigningInput(
      { source: "discord_approval" },
      {
        supabase,
        takeSnapshotFn: snapshotFn,
        quote: {
          ...buildSigningInput().quote,
          status: "generated",
          docuseal_submission_id: "existing-sub-42",
        },
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              id: "existing-sub-42",
              submitters: [
                { slug: "axona" },
                { slug: "customer" },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      },
    );

    const result = await createSigningSubmission(input);

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toMatchObject({
      docuseal_submission_id: "existing-sub-42",
      docuseal_signing_url: "https://test-docuseal.local/s/customer",
      status: "sent",
      approved_at: "2026-04-15T10:00:00.000Z",
      sent_at: "2026-04-15T10:00:00.000Z",
    });
    expect(snapshotFn).toHaveBeenCalledWith({
      quoteId: 42,
      triggerEvent: "sent_for_signing",
      oldStatus: "generated",
      newStatus: "sent",
      initiatorSource: "discord_approval",
      metadata: {
        submissionId: "existing-sub-42",
        recoveredExistingSubmission: true,
      },
    });
    expect(result.reusedExistingSubmission).toBe(false);
    expect(result.shouldSendSigningEmail).toBe(true);
    expect(result.submissionId).toBe("existing-sub-42");
  });
});

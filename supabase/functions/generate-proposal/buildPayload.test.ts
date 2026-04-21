import { assertEquals } from "jsr:@std/assert@1";
import { buildProposalPayload, formatFrenchDate } from "./buildPayload.ts";

Deno.test("formatFrenchDate formats in French", () => {
  assertEquals(formatFrenchDate(new Date(2026, 3, 20)), "20 avril 2026");
  assertEquals(formatFrenchDate(new Date(2025, 0, 1)), "1 janvier 2025");
  assertEquals(formatFrenchDate(new Date(2026, 11, 31)), "31 décembre 2026");
});

Deno.test(
  "buildProposalPayload: minimal fields (no sector, no contact, no sales)",
  () => {
    const result = buildProposalPayload({
      deal: { id: 1337, sales_id: null, contact_ids: null },
      company: { name: "Cabinet Martin", sector: null },
      contact: null,
      sales: null,
      now: new Date(2026, 3, 20),
    });
    assertEquals(result, {
      clientName: "Cabinet Martin",
      proposalRef: "NSH-2026-1337",
      proposalDate: "20 avril 2026",
    });
  },
);

Deno.test("buildProposalPayload: full fields", () => {
  const result = buildProposalPayload({
    deal: { id: 42, sales_id: 1, contact_ids: [1] },
    company: { name: "Acme", sector: "Tech" },
    contact: { first_name: "Jane", last_name: "Doe" },
    sales: { first_name: "Paul", last_name: "Dupont" },
    now: new Date(2026, 3, 20),
  });
  assertEquals(result, {
    clientName: "Acme",
    clientType: "Tech",
    clientContact: "Jane Doe",
    proposalRef: "NSH-2026-42",
    proposalDate: "20 avril 2026",
    senderName: "Paul Dupont",
  });
});

Deno.test("buildProposalPayload: omits empty contact/sales names", () => {
  const result = buildProposalPayload({
    deal: { id: 1, sales_id: null, contact_ids: null },
    company: { name: "X", sector: null },
    contact: { first_name: "", last_name: "" },
    sales: { first_name: null, last_name: null },
    now: new Date(2026, 3, 20),
  });
  assertEquals(result.clientContact, undefined);
  assertEquals(result.senderName, undefined);
});

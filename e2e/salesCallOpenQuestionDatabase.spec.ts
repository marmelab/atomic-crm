import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";
import vectors from "../contracts/sales-calls/openQuestionVectors.json" with { type: "json" };

// The DATABASE arm of the cross-runtime agreement — the authority itself.
//
// public.sales_call_open_question() is what the app mirrors and what the
// Acuity handler must not contradict. The app arm is
// contracts/sales-calls/openQuestionAppMirror.test.ts and the Edge arm is
// supabase/functions/acuity_webhook/acuityCrossRuntimeContract.test.ts;
// all three read the SAME vectors and evaluate them at the SAME instant,
// so a disagreement is a disagreement and never a clock.
//
// Running it here rather than against production is deliberate: this
// database is built from the migration chain, so the function under test
// is the one a deploy would ship, not the one that happens to be live.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341";

const admin = () =>
  createClient(SUPABASE_URL, process.env.SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const askTheAuthority = async (
  call: (typeof vectors.vectors)[number]["call"],
) => {
  const { data, error } = await admin().rpc("sales_call_open_question", {
    p_opportunity_id: call.opportunity_id,
    p_dismissed_at: call.dismissed_at,
    p_status: call.status,
    p_attendance: call.attendance,
    p_scheduled_at: call.scheduled_at,
    p_scheduled_on: call.scheduled_on,
    p_resolution_requested_at: call.resolution_requested_at,
    p_now: vectors.now,
  });
  if (error) throw new Error(error.message);
  return data as string;
};

test.describe("sales_call_open_question — the authority answers the canonical vectors", () => {
  test("the contract has vectors, so an emptied file cannot pass", () => {
    expect(vectors.vectors.length).toBeGreaterThan(0);
  });

  for (const vector of vectors.vectors) {
    test(`${vector.id} -> ${vector.expected_question}`, async () => {
      expect(await askTheAuthority(vector.call), vector.description).toBe(
        vector.expected_question,
      );
    });
  }

  test("never asks what happened on a call that has not happened", async () => {
    const offenders: string[] = [];
    for (const vector of vectors.vectors) {
      const answer = await askTheAuthority(vector.call);
      const scheduledAt = vector.call.scheduled_at;
      if (
        answer === "attendance" &&
        scheduledAt != null &&
        new Date(scheduledAt) > new Date(vectors.now)
      ) {
        offenders.push(vector.id);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("never infers attendance from a missing attendance value alone", async () => {
    const vector = vectors.vectors.find(
      (candidate) => candidate.id === "past-attached-no-resolution-requested",
    )!;
    expect(await askTheAuthority(vector.call)).toBe("none");
  });
});

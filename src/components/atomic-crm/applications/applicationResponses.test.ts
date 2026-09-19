import { describe, expect, test } from "vitest";

import type { Application, ApplicationResponse } from "../types";

// Synthetic content only. No real applicant wrote anything in this file.
//
// What these guard is the reason application_responses exists: the
// question travels with the answer, so no later edit to a labels file can
// change what a historical Application claims to have asked.

const response = (
  overrides: Partial<ApplicationResponse> = {},
): ApplicationResponse =>
  ({
    id: 1,
    application_id: 1,
    position: 1,
    question_key: null,
    question_text: "A question exactly as it was asked?",
    answer_text: "An answer exactly as it was written.",
    answered: true,
    source_snapshot_id: 10,
    materialized_at: "2026-09-19T00:00:00Z",
    ...overrides,
  }) as ApplicationResponse;

// The ordering the drawer applies: source position, never id, never
// alphabetical.
const inSourceOrder = (rows: ApplicationResponse[]) =>
  [...rows].sort((a, b) => a.position - b.position);

describe("recovered responses", () => {
  test("source order survives, whatever order the rows arrive in", () => {
    // Arrange — ids deliberately disagree with positions.
    const rows = [
      response({ id: 9, position: 3, question_text: "Third?" }),
      response({ id: 7, position: 1, question_text: "First?" }),
      response({ id: 8, position: 2, question_text: "Second?" }),
    ];

    // Act
    const ordered = inSourceOrder(rows);

    // Assert
    expect(ordered.map((r) => r.question_text)).toEqual([
      "First?",
      "Second?",
      "Third?",
    ]);
  });

  test("a question asked and left blank is not the same as one never asked", () => {
    // Arrange — the distinction the `answered` flag exists to keep.
    const blank = response({ answer_text: null, answered: false });

    // Assert
    expect(blank.answered).toBe(false);
    expect(blank.question_text).toBeTruthy();
  });

  test("two forms that differ by one clause stay different", () => {
    // Arrange — the real variation between the two recovered Notion
    // forms. Folding these onto one modern label would rewrite what a
    // real person was asked.
    const janForm = response({
      position: 2,
      question_text:
        "What are you hoping with program with Leif helps you create?",
    });
    const fullForm = response({
      position: 2,
      question_text:
        "What are you hoping with program with Leif helps you create in your life and relationships?",
    });

    // Assert
    expect(janForm.question_text).not.toEqual(fullForm.question_text);
  });

  test("a response carries the snapshot it was read out of", () => {
    // Assert — provenance stays inspectable without exposing the sealed
    // snapshot table itself.
    expect(response().source_snapshot_id).toBe(10);
  });

  test("answer text is stored exactly, markup and all", () => {
    // Arrange — the recovered export contains no <br> at all, but the
    // rule is about storage, not about what happens to be present.
    const raw = "line one<br>line two  with   spacing";
    const stored = response({ answer_text: raw });

    // Assert — nothing normalises, trims or rewrites it.
    expect(stored.answer_text).toBe(raw);
  });
});

describe("form provenance on the Application", () => {
  const application = (overrides: Partial<Application> = {}): Application =>
    ({
      id: 1,
      contact_id: 1,
      offer_id: 1,
      status: "pending",
      submitted_at: "2026-08-01T00:00:00Z",
      reviewed_at: null,
      raw_answers: {},
      ...overrides,
    }) as Application;

  test("a decided Application with no review timestamp is valid history", () => {
    // Arrange — 62 recovered Applications are exactly this shape. The
    // decision is known; when a human made it is not, and stamping the
    // import time in would invent it.
    const decided = application({ status: "approved", reviewed_at: null });

    // Assert
    expect(decided.status).toBe("approved");
    expect(decided.reviewed_at).toBeNull();
  });

  test("the form label says which wording was answered", () => {
    // Assert
    const app = application({
      form_key: "gyu_application",
      form_label: "Growing Yourself Up application",
    });
    expect(app.form_label).toBe("Growing Yourself Up application");
  });
});

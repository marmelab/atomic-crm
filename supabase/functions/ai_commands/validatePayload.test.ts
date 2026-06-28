import { describe, expect, it } from "vitest";
import { validatePayload } from "./validatePayload";

describe("validatePayload", () => {
  it("accepts a valid create_luke_task payload", () => {
    expect(
      validatePayload("create_luke_task", {
        title: "Research Acme",
        contact_id: 42,
      }),
    ).toEqual({
      title: "Research Acme",
      text: "Research Acme",
      contact_id: 42,
      due_date: undefined,
      priority: "medium",
      success_definition: undefined,
      type: "Research",
    });
  });

  it("rejects a missing title", () => {
    expect(() =>
      validatePayload("create_luke_task", { contact_id: 42 }),
    ).toThrow("payload.title is required");
  });

  it("rejects an invalid priority", () => {
    expect(() =>
      validatePayload("create_luke_task", {
        title: "Research Acme",
        contact_id: 42,
        priority: "later",
      }),
    ).toThrow("payload.priority must be low, medium, high, or urgent");
  });

  it("rejects an unsupported command type", () => {
    expect(() =>
      validatePayload("push_to_instantly", {
        title: "Research Acme",
        contact_id: 42,
      }),
    ).toThrow("Unsupported command_type: push_to_instantly");
  });
});

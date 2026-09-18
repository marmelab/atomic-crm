import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
  CONTACT_MERGE_DISABLED_CODE,
  CONTACT_MERGE_DISABLED_STATUS,
  handleContactMergeRequest,
} from "./mergeDisabled.ts";

// Slice 0, requirement A: the endpoint refuses before it mutates.
//
// The strongest available proof is structural. handleContactMergeRequest
// answers every authenticated request to this endpoint, and the module it
// lives in imports only cors.ts and utils.ts — neither of which can open a
// database connection. There is no path from a request to a write, so no
// partial transaction and no deleted Contact is reachable.

const post = () =>
  new Request("https://example.test/merge_contacts", {
    method: "POST",
    body: JSON.stringify({ loserId: 1, winnerId: 2 }),
  });

describe("the merge endpoint refuses before it can mutate", () => {
  test("a well-formed merge request is refused", async () => {
    // Arrange
    const request = post();

    // Act
    const response = handleContactMergeRequest(request, "user-1", () => {});

    // Assert
    expect(response.status).toBe(CONTACT_MERGE_DISABLED_STATUS);
    const body = await response.json();
    expect(body.code).toBe(CONTACT_MERGE_DISABLED_CODE);
    expect(body.success).toBe(false);
    expect(body.merged).toBe(false);
    expect(body.message).toMatch(/temporarily unavailable/i);
  });

  test("the request body is never read, so no merge can be inferred", () => {
    // Arrange — a refusal that consumed the body would leave it used, and
    // reading the body at all is the first step toward acting on it.
    const request = post();

    // Act
    handleContactMergeRequest(request, "user-1", () => {});

    // Assert
    expect(request.bodyUsed).toBe(false);
  });

  test("the attempt is logged with the operator, and no contact ids", () => {
    // Arrange
    const lines: string[] = [];

    // Act
    handleContactMergeRequest(post(), "user-42", (line) => lines.push(line));

    // Assert
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.event).toBe(CONTACT_MERGE_DISABLED_CODE);
    expect(entry.attempted_by).toBe("user-42");
    expect(Object.keys(entry).sort()).toEqual(["at", "attempted_by", "event"]);
  });

  test("any other method is still Method Not Allowed", async () => {
    // Arrange / Act
    const response = handleContactMergeRequest(
      new Request("https://example.test/merge_contacts", { method: "GET" }),
      "user-1",
      () => {},
    );

    // Assert
    expect(response.status).toBe(405);
  });

  test("the refusing module cannot reach the database", () => {
    // Arrange — the structural guarantee, asserted rather than trusted.
    const source = readFileSync(
      new URL("./mergeDisabled.ts", import.meta.url),
      "utf8",
    );

    // Assert
    expect(source).not.toMatch(/_shared\/db\.ts/);
    expect(source).not.toMatch(/\bkysely\b/);
    expect(source).not.toMatch(/supabase-js/);
  });

  test("nothing in the function still routes a request into the merge", () => {
    // Arrange — mergeContacts() is retained but must be unreachable until
    // Slice 5 replaces it. If a future edit wires it back up, this fails.
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

    // Assert
    expect(index).toMatch(/handleContactMergeRequest/);
    // The only remaining occurrences are the declaration and its comment.
    const calls = index.match(/\bawait mergeContacts\(|= mergeContacts\(/g);
    expect(calls).toBeNull();
  });
});

// Unit tests for the review-verdict path resolution (lib/reviews.mjs).
// reviewsDir() prefers CHAT_SESSION_DIR (set by a managed launcher such as CRM
// Builder's chat-service, where <session_dir> is NOT the /tmp/<repo>/<id> path the
// hooks recompute) and falls back to ctx.sessionDir otherwise. Both branches are
// pinned here so the quality-reviewer's synchronous flag write and the hooks that
// read/clear it never drift apart again.

import { describe, test, expect, afterEach } from "vitest";
import { reviewsDir, reviewFlag } from "../lib/reviews.mjs";

const ORIG = process.env.CHAT_SESSION_DIR;
afterEach(() => {
  if (ORIG === undefined) delete process.env.CHAT_SESSION_DIR;
  else process.env.CHAT_SESSION_DIR = ORIG;
});

describe("reviews path resolution", () => {
  test("falls back to ctx.sessionDir when CHAT_SESSION_DIR is unset", () => {
    delete process.env.CHAT_SESSION_DIR;
    const ctx = { sessionDir: "/tmp/_app/uuid" };
    expect(reviewsDir(ctx)).toBe("/tmp/_app/uuid/reviews");
    expect(reviewFlag(ctx, "TASK-001", "quality-reviewer")).toBe(
      "/tmp/_app/uuid/reviews/TASK-001-quality-reviewer",
    );
  });

  test("prefers CHAT_SESSION_DIR (managed launcher) over ctx.sessionDir", () => {
    process.env.CHAT_SESSION_DIR = "/chat-service/logs/uuid";
    const ctx = { sessionDir: "/tmp/_app/uuid" };
    expect(reviewsDir(ctx)).toBe("/chat-service/logs/uuid/reviews");
    expect(reviewFlag(ctx, "TASK-001", "quality-reviewer")).toBe(
      "/chat-service/logs/uuid/reviews/TASK-001-quality-reviewer",
    );
  });
});

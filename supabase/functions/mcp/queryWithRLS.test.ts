// @vitest-environment node
import { afterEach, describe, it, expect, vi } from "vitest";

vi.hoisted(() => {
  const env: Record<string, string> = {
    SUPABASE_URL: "http://supabase.test",
    SB_PUBLISHABLE_KEY: "publishable-key",
  };
  vi.stubGlobal("Deno", { env: { get: (name: string) => env[name] } });
});

import { runQueryWithRLS } from "./queryWithRLS";

const CHANGE_LIST = JSON.stringify([
  {
    type: "DELETE",
    old_record: { attachments: [{ path: "contract.pdf" }] },
    record: { attachments: null },
  },
]);

const createDatabase = ({ failCommit = false } = {}) => {
  const events: string[] = [];
  const client = {
    queryObject: async (query: string | { text: string }) => {
      const text = typeof query === "string" ? query : query.text;
      if (text.includes("current_setting")) {
        return { rows: [{ setting: CHANGE_LIST }] };
      }
      if (text === "COMMIT") {
        events.push("commit");
        if (failCommit) {
          throw new Error("could not serialize access");
        }
      }
      return { rows: [] };
    },
    release: () => {
      events.push("release");
    },
  };
  const pool = { connect: async () => client };
  return { pool: pool as never, events };
};

const spyOnStorage = (events: string[]) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    events.push(`storage delete ${String(init?.body)}`);
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

const query = (isWrite: boolean) => ({
  sql: "DELETE FROM contact_notes WHERE id = 1",
  userToken: "user-token",
  claimsJson: "{}",
  isWrite,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runQueryWithRLS", () => {
  it("never deletes attachment files for a read-only query, even when the model forged a change list", async () => {
    const { pool, events } = createDatabase();
    const fetchSpy = spyOnStorage(events);

    const result = await runQueryWithRLS(pool, query(false));

    expect(result).toEqual({ success: true, data: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("deletes the removed files once, after COMMIT and after releasing the connection", async () => {
    const { pool, events } = createDatabase();
    spyOnStorage(events);

    const result = await runQueryWithRLS(pool, query(true));

    expect(result).toEqual({ success: true, data: [] });
    expect(events).toEqual([
      "commit",
      "release",
      'storage delete {"prefixes":["contract.pdf"]}',
    ]);
  });

  it("deletes no file and reports the error when COMMIT fails", async () => {
    const { pool, events } = createDatabase({ failCommit: true });
    const fetchSpy = spyOnStorage(events);

    const result = await runQueryWithRLS(pool, query(true));

    expect(result).toEqual({
      success: false,
      error: "could not serialize access",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

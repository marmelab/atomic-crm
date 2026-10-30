// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  createRlsPostgres,
  SEARCH_PATH,
  STATEMENT_TIMEOUT,
  type SqlClient,
  type SqlPool,
} from "./rlsPostgres";

interface RecordedQuery {
  text: string;
  params?: unknown[];
}

interface StubOptions {
  // Thrown when the user statement (anything that is not part of the
  // transaction prelude) runs.
  failUserStatement?: Error;
  failRollback?: boolean;
}

const PRELUDE = new Set([
  "begin",
  "commit",
  "rollback",
  "set transaction read only",
]);

function isPrelude(text: string): boolean {
  return (
    PRELUDE.has(text) ||
    text.startsWith("select set_config('request.jwt.claims'") ||
    text.startsWith("set local ")
  );
}

function stubPool(options: StubOptions = {}) {
  const queries: RecordedQuery[] = [];
  const releases: (boolean | undefined)[] = [];
  const client: SqlClient = {
    query: async (text, params) => {
      queries.push({ text, params });
      if (text === "rollback" && options.failRollback) {
        throw new Error("connection lost");
      }
      if (!isPrelude(text) && options.failUserStatement) {
        throw options.failUserStatement;
      }
      return { rows: [{ ok: true }] };
    },
    release: (destroy) => {
      releases.push(destroy);
    },
  };
  const pool: SqlPool = { connect: async () => client };
  return { pool, queries, releases };
}

const claims = { role: "authenticated", sub: "user-1" };

describe("createRlsPostgres", () => {
  it("wraps the statement in an RLS-scoped, search_path-pinned, time-limited transaction", async () => {
    // Arrange
    const { pool, queries, releases } = stubPool();
    const postgres = createRlsPostgres(pool, claims);

    // Act
    const rows = await postgres.query("select * from contacts");

    // Assert
    expect(queries.map((q) => q.text)).toEqual([
      "begin",
      "select set_config('request.jwt.claims', $1, true)",
      'set local role "authenticated"',
      `set local search_path = ${SEARCH_PATH}`,
      `set local statement_timeout = '${STATEMENT_TIMEOUT}'`,
      "select * from contacts",
      "commit",
    ]);
    expect(queries[1].params).toEqual([JSON.stringify(claims)]);
    expect(rows).toEqual([{ ok: true }]);
    expect(releases).toEqual([false]);
  });

  it("pins the search_path to public only", () => {
    expect(SEARCH_PATH).toBe("public");
  });

  it("makes the transaction read only when asked", async () => {
    // Arrange
    const { pool, queries } = stubPool();
    const postgres = createRlsPostgres(pool, claims);

    // Act
    await postgres.query("select 1", undefined, { readOnly: true });

    // Assert
    const texts = queries.map((q) => q.text);
    expect(texts.indexOf("set transaction read only")).toBeGreaterThan(
      texts.indexOf('set local role "authenticated"'),
    );
    expect(texts.indexOf("set transaction read only")).toBeLessThan(
      texts.indexOf("select 1"),
    );
  });

  it("passes bind parameters through to the statement", async () => {
    // Arrange
    const { pool, queries } = stubPool();
    const postgres = createRlsPostgres(pool, claims);

    // Act
    await postgres.query(
      "update tasks set done_date = now() where id = $1",
      [42],
    );

    // Assert
    expect(queries.at(-2)).toEqual({
      text: "update tasks set done_date = now() where id = $1",
      params: [42],
    });
  });

  it("rolls back, releases the connection and rethrows when the statement fails", async () => {
    // Arrange
    const failure = new Error("boom");
    const { pool, queries, releases } = stubPool({
      failUserStatement: failure,
    });
    const postgres = createRlsPostgres(pool, claims);

    // Act
    const run = postgres.query("select bad");

    // Assert
    await expect(run).rejects.toBe(failure);
    expect(queries.map((q) => q.text)).toContain("rollback");
    expect(queries.map((q) => q.text)).not.toContain("commit");
    expect(releases).toEqual([false]);
  });

  it("destroys the connection when the rollback itself fails", async () => {
    // Arrange
    const { pool, releases } = stubPool({
      failUserStatement: new Error("boom"),
      failRollback: true,
    });
    const postgres = createRlsPostgres(pool, claims);

    // Act
    await expect(postgres.query("select bad")).rejects.toThrow("boom");

    // Assert
    expect(releases).toEqual([true]);
  });

  it("explains permission denied errors in terms of the caller's role", async () => {
    // Arrange
    const denied = Object.assign(new Error("permission denied for table x"), {
      code: "42501",
    });
    const { pool } = stubPool({ failUserStatement: denied });
    const postgres = createRlsPostgres(pool, claims);

    // Act & Assert
    await expect(postgres.query("select * from x")).rejects.toThrow(
      /grant select on <table> to authenticated/,
    );
  });

  it.each([
    ["service_role", { role: "service_role", sub: "user-1" }],
    ["anon", { role: "anon" }],
    ["a missing role", { sub: "user-1" }],
  ])("refuses %s before touching the database", (_label, badClaims) => {
    // Arrange
    const { pool, queries } = stubPool();

    // Act & Assert
    expect(() => createRlsPostgres(pool, badClaims)).toThrow(
      /Unsupported role/,
    );
    expect(queries).toHaveLength(0);
  });
});

// RLS-scoped SQL execution for the MCP tools.
//
// Replaces @supabase/server's withPostgresClient, which runs every query as
// `begin; set_config(claims); set local role; <sql>; commit` and offers no way
// to extend that prelude. The connection string is Supabase's SUPABASE_DB_URL,
// i.e. the `postgres` role (BYPASSRLS, member of service_role), so everything
// that keeps a query inside the caller's rights happens in this transaction.
//
// This module has no npm: imports on purpose: it only needs the `query` and
// `release` shape of a pg client, so the unit tests drive it with a stub.

export interface SqlQueryResult {
  rows: unknown[];
}

export interface SqlClient {
  query(text: string, params?: unknown[]): Promise<SqlQueryResult>;
  release(destroy?: boolean): void;
}

export interface SqlPool {
  connect(): Promise<SqlClient>;
}

export interface QueryOptions {
  // Runs the statement in a READ ONLY transaction: Postgres then refuses any
  // write, including those hidden inside a volatile function called from a
  // SELECT (merge_contacts, pg_net's request queue...).
  readOnly?: boolean;
}

export interface RlsPostgres {
  query(
    text: string,
    params?: unknown[],
    options?: QueryOptions,
  ): Promise<unknown[]>;
}

// Only role the MCP endpoint ever assumes. withSupabase({ auth: "user" })
// already guarantees a user token; refusing anything else here means a
// surprising claim can never widen the role instead of silently narrowing it.
const ALLOWED_ROLE = "authenticated";

// Same budget as the `authenticated` role gets through PostgREST. That role
// setting does not apply here: statement_timeout from a role's config is read
// at login, and this connection logs in as `postgres`, not as `authenticated`.
export const STATEMENT_TIMEOUT = "8s";

// Only `public` (pg_catalog stays implicit). `extensions` and `net` hold the
// http functions that let a query make the database issue HTTP requests;
// keeping them off the search_path means an unqualified `http_get(...)` does
// not resolve, whatever the SQL validator did or did not catch. Functions in
// `public` carry their own `SET search_path`, so they are unaffected.
export const SEARCH_PATH = "public";

const PERMISSION_DENIED = "42501";

function resolveRole(claims: Record<string, unknown>): string {
  const requested = claims.role;
  if (requested !== ALLOWED_ROLE) {
    throw new Error(
      `Unsupported role ${JSON.stringify(requested)}: the MCP server only runs queries as "${ALLOWED_ROLE}".`,
    );
  }
  return requested;
}

async function runInTransaction(
  client: SqlClient,
  claims: Record<string, unknown>,
  role: string,
  text: string,
  params: unknown[] | undefined,
  options: QueryOptions,
): Promise<unknown[]> {
  await client.query("begin");
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify(claims),
  ]);
  await client.query(`set local role "${role}"`);
  await client.query(`set local search_path = ${SEARCH_PATH}`);
  await client.query(`set local statement_timeout = '${STATEMENT_TIMEOUT}'`);
  if (options.readOnly) {
    await client.query("set transaction read only");
  }
  const result = await client.query(text, params);
  await client.query("commit");
  return result.rows;
}

export function createRlsPostgres(
  pool: SqlPool,
  claims: Record<string, unknown>,
): RlsPostgres {
  const role = resolveRole(claims);
  return {
    async query(text, params, options = {}) {
      const client = await pool.connect();
      let poisoned = false;
      try {
        return await runInTransaction(
          client,
          claims,
          role,
          text,
          params,
          options,
        );
      } catch (error) {
        try {
          await client.query("rollback");
        } catch {
          // The connection is in an unknown state: drop it from the pool.
          poisoned = true;
        }
        if (
          error instanceof Error &&
          (error as { code?: string }).code === PERMISSION_DENIED
        ) {
          error.message += ` (queries run as the caller's role '${role}'; grant that role the table privileges it needs, e.g. "grant select on <table> to ${role}")`;
        }
        throw error;
      } finally {
        if (!poisoned) {
          // The pool is shared by every caller and logs in as `postgres`:
          // drop whatever session state the statement may have left behind
          // (session-level advisory locks, LISTEN, temp objects...) so nothing
          // carries over to the next request.
          try {
            await client.query("discard all");
          } catch {
            poisoned = true;
          }
        }
        client.release(poisoned);
      }
    },
  };
}

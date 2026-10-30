import { parse, type Statement } from "npm:pgsql-ast-parser@^12";

const ALLOWED_READ_TYPES = new Set(["select", "with"]);
const ALLOWED_WRITE_TYPES = new Set(["insert", "update", "delete", "with"]);

// RLS reads the caller's identity from the request.jwt.claims setting, and the
// role from the role setting. A query able to call set_config() could rewrite
// either mid-statement and act as another user, so it is never allowed.
const FORBIDDEN_FUNCTIONS = new Set(["set_config"]);

// Schema-qualified calls may only target these schemas. `extensions` (http
// extension) and `net` (pg_net) hold functions that make the database issue
// HTTP requests, which turns the query tool into an SSRF primitive; their
// EXECUTE grants cannot be revoked from a migration (they are owned by
// supabase_admin), so the endpoint has to refuse them itself. Unqualified
// names are left to Postgres: the transaction wrapper sets search_path to
// `public` (pg_catalog is implicit), so an unqualified `http_get(...)` does not
// resolve at all. The two layers back each other up.
const ALLOWED_FUNCTION_SCHEMAS = new Set(["public", "pg_catalog", "auth"]);

interface FunctionCall {
  schema?: string;
  name: string;
}

function isFunctionCallNode(
  node: unknown,
): node is { type: "call"; function: FunctionCall } {
  if (typeof node !== "object" || node === null) return false;
  const candidate = node as { type?: unknown; function?: unknown };
  return (
    candidate.type === "call" &&
    typeof candidate.function === "object" &&
    candidate.function !== null &&
    typeof (candidate.function as FunctionCall).name === "string"
  );
}

// Walk the raw AST rather than pgsql-ast-parser's astVisitor: the visitor only
// reaches the fields its default mapper enumerates, and it skips the
// expression lists of `DISTINCT ON (...)` and `OVER (...)`, which was enough
// to smuggle a set_config() call past the previous version of this check.
// Descending into every object and array reaches a call wherever it sits.
function collectFunctionCalls(node: unknown, calls: FunctionCall[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectFunctionCalls(child, calls);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  if (isFunctionCallNode(node)) {
    calls.push(node.function);
  }
  for (const child of Object.values(node)) collectFunctionCalls(child, calls);
}

function findForbiddenCall(stmts: Statement[]): string | null {
  const calls: FunctionCall[] = [];
  collectFunctionCalls(stmts, calls);
  for (const call of calls) {
    const name = call.name.toLowerCase();
    if (FORBIDDEN_FUNCTIONS.has(name)) {
      return `Function "${call.name}" is not allowed.`;
    }
    const schema = call.schema?.toLowerCase();
    if (schema !== undefined && !ALLOWED_FUNCTION_SCHEMAS.has(schema)) {
      return `Function "${call.schema}.${call.name}" is not allowed: only functions from the ${[...ALLOWED_FUNCTION_SCHEMAS].join(", ")} schemas can be called.`;
    }
  }
  return null;
}

// Collect all statement types found in a parsed AST, including inner
// statements in WITH (CTE) bindings which can contain writable DML.
function collectStatementTypes(stmts: Statement[]): Set<string> {
  const types = new Set<string>();
  for (const stmt of stmts) {
    types.add(stmt.type);
    if (stmt.type === "with" && "bind" in stmt && Array.isArray(stmt.bind)) {
      for (const cte of stmt.bind) {
        if (cte.statement?.type) {
          types.add(cte.statement.type);
        }
      }
    }
  }
  return types;
}

function parseSingleStatement(
  sql: string,
): { stmts: Statement[] } | { error: string } {
  let stmts: Statement[];
  try {
    stmts = parse(sql);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // pgsql-ast-parser appends a parse-table dump that is useless to the
    // LLM and consumes many tokens; keep the diagnostic prefix only.
    const message = raw.split("Here is the state of my parse table")[0].trim();
    return { error: `Failed to parse SQL: ${message}` };
  }
  if (stmts.length === 0) {
    return { error: "Empty query." };
  }
  if (stmts.length > 1) {
    return { error: "Only a single statement is allowed." };
  }
  return { stmts };
}

export function validateReadOnly(sql: string): string | null {
  const parsed = parseSingleStatement(sql);
  if ("error" in parsed) return parsed.error;
  for (const type of collectStatementTypes(parsed.stmts)) {
    if (!ALLOWED_READ_TYPES.has(type)) {
      return `Statement type "${type}" is not allowed in read-only queries. Use the mutate tool for data modifications.`;
    }
  }
  return findForbiddenCall(parsed.stmts);
}

export function validateWrite(sql: string): string | null {
  const parsed = parseSingleStatement(sql);
  if ("error" in parsed) return parsed.error;
  for (const type of collectStatementTypes(parsed.stmts)) {
    if (!ALLOWED_WRITE_TYPES.has(type)) {
      return `Statement type "${type}" is not allowed. Only INSERT, UPDATE, and DELETE statements are supported.`;
    }
  }
  return findForbiddenCall(parsed.stmts);
}

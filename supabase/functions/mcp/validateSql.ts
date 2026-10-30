import { parse, type Statement } from "npm:pgsql-ast-parser@^12";

const ALLOWED_READ_TYPES = new Set(["select", "with"]);
const ALLOWED_WRITE_TYPES = new Set(["insert", "update", "delete", "with"]);

// RLS reads the caller's identity from the request.jwt.claims setting, and the
// role from the role setting. A query able to call set_config() could rewrite
// either mid-statement and act as another user, so it is never allowed.
//
// The *_to_xml family takes a query or an object name as a TEXT argument and
// executes it: the SQL inside the string is invisible to the AST walk below
// and resolves names against the real catalog, so it would reach the `net`
// and `extensions` objects the schema allowlist refuses. These functions live
// in pg_catalog with a PUBLIC grant that migrations cannot revoke (owned by
// supabase_admin), so they are refused here by name. The CRM never uses them.
const FORBIDDEN_FUNCTIONS = new Set([
  "set_config",
  "query_to_xml",
  "query_to_xmlschema",
  "query_to_xml_and_xmlschema",
  "table_to_xml",
  "table_to_xmlschema",
  "table_to_xml_and_xmlschema",
  "cursor_to_xml",
  "cursor_to_xmlschema",
  "database_to_xml",
  "database_to_xmlschema",
  "database_to_xml_and_xmlschema",
  "schema_to_xml",
  "schema_to_xmlschema",
  "schema_to_xml_and_xmlschema",
]);

// Schema-qualified references (tables, functions, types...) may only target
// these schemas. `extensions` (http extension) and `net` (pg_net) hold the
// functions AND the queue tables that make the database issue HTTP requests,
// which turns the SQL tools into an SSRF primitive; their grants cannot be
// revoked from a migration (they are owned by supabase_admin), so the endpoint
// has to refuse them itself. Unqualified names are left to Postgres: the
// transaction wrapper sets search_path to `public` (pg_catalog is implicit),
// so an unqualified `http_get(...)` or `http_request_queue` does not resolve at
// all. The two layers back each other up.
const ALLOWED_SCHEMAS = new Set([
  "public",
  "pg_catalog",
  "auth",
  "information_schema",
]);

interface QualifiedName {
  schema?: string;
  name: string;
}

// pgsql-ast-parser gives every named reference (table, function, type, column
// qualifier) the same { schema?, name } shape, so one predicate covers them.
function isQualifiedName(node: object): node is QualifiedName {
  const candidate = node as { schema?: unknown; name?: unknown };
  return (
    typeof candidate.schema === "string" && typeof candidate.name === "string"
  );
}

function isFunctionCallNode(
  node: object,
): node is { type: "call"; function: { name: string } } {
  const candidate = node as { type?: unknown; function?: unknown };
  return (
    candidate.type === "call" &&
    typeof candidate.function === "object" &&
    candidate.function !== null &&
    typeof (candidate.function as { name?: unknown }).name === "string"
  );
}

// Walk the raw AST rather than pgsql-ast-parser's astVisitor: the visitor only
// reaches the fields its default mapper enumerates, and it skips the
// expression lists of `DISTINCT ON (...)` and `OVER (...)`, which was enough
// to smuggle a set_config() call past the previous version of this check.
// Descending into every object and array reaches a node wherever it sits.
function findForbiddenReference(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findForbiddenReference(child);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object" || node === null) return null;
  if (
    isFunctionCallNode(node) &&
    FORBIDDEN_FUNCTIONS.has(node.function.name.toLowerCase())
  ) {
    return `Function "${node.function.name}" is not allowed.`;
  }
  if (
    isQualifiedName(node) &&
    !ALLOWED_SCHEMAS.has(node.schema.toLowerCase())
  ) {
    return `Reference to "${node.schema}.${node.name}" is not allowed: only objects from the ${[...ALLOWED_SCHEMAS].join(", ")} schemas can be used.`;
  }
  for (const child of Object.values(node)) {
    const found = findForbiddenReference(child);
    if (found) return found;
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
  return findForbiddenReference(parsed.stmts);
}

export function validateWrite(sql: string): string | null {
  const parsed = parseSingleStatement(sql);
  if ("error" in parsed) return parsed.error;
  for (const type of collectStatementTypes(parsed.stmts)) {
    if (!ALLOWED_WRITE_TYPES.has(type)) {
      return `Statement type "${type}" is not allowed. Only INSERT, UPDATE, and DELETE statements are supported.`;
    }
  }
  return findForbiddenReference(parsed.stmts);
}

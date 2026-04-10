import { parse, type Statement } from "npm:pgsql-ast-parser@^12";

const ALLOWED_READ_TYPES = new Set(["select", "with"]);
const ALLOWED_WRITE_TYPES = new Set(["insert", "update", "delete", "with"]);

// Functions that can modify session state, access the filesystem, or cause DoS.
// Checked after parsing to prevent privilege escalation via SELECT set_config(...).
const DENIED_FUNCTIONS = new Set([
  "set_config",
  "pg_sleep",
  "pg_sleep_for",
  "pg_sleep_until",
  "lo_import",
  "lo_export",
  "lo_unlink",
  "lo_create",
  "lo_open",
  "pg_read_file",
  "pg_read_binary_file",
  "pg_ls_dir",
  "pg_stat_file",
  "pg_terminate_backend",
  "pg_cancel_backend",
  "pg_reload_conf",
  "pg_rotate_logfile",
  "dblink",
  "dblink_exec",
  "dblink_connect",
]);

// Strip single-quoted string literals so denylist checks don't match on data values.
function stripStringLiterals(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'/g, "''");
}

function containsDeniedFunction(sql: string): string | null {
  const stripped = stripStringLiterals(sql).toLowerCase();
  for (const fn of DENIED_FUNCTIONS) {
    const pattern = new RegExp(`\\b${fn}\\s*\\(`, "i");
    if (pattern.test(stripped)) {
      return `Function "${fn}" is not allowed.`;
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

export function validateReadOnly(sql: string): string | null {
  let stmts: Statement[];
  try {
    stmts = parse(sql);
  } catch {
    return "Failed to parse SQL. Please check your query syntax.";
  }
  if (stmts.length === 0) {
    return "Empty query.";
  }
  if (stmts.length > 1) {
    return "Only a single statement is allowed.";
  }
  const types = collectStatementTypes(stmts);
  for (const type of types) {
    if (!ALLOWED_READ_TYPES.has(type)) {
      return `Statement type "${type}" is not allowed in read-only queries. Use the mutate tool for data modifications.`;
    }
  }
  return containsDeniedFunction(sql);
}

export function validateWrite(sql: string): string | null {
  let stmts: Statement[];
  try {
    stmts = parse(sql);
  } catch {
    return "Failed to parse SQL. Please check your query syntax.";
  }
  if (stmts.length === 0) {
    return "Empty query.";
  }
  if (stmts.length > 1) {
    return "Only a single statement is allowed.";
  }
  const types = collectStatementTypes(stmts);
  for (const type of types) {
    if (!ALLOWED_WRITE_TYPES.has(type)) {
      return `Statement type "${type}" is not allowed. Only INSERT, UPDATE, and DELETE statements are supported.`;
    }
  }
  return containsDeniedFunction(sql);
}

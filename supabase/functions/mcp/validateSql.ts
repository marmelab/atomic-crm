import { astVisitor, parse, type Statement } from "npm:pgsql-ast-parser@^12";

const ALLOWED_READ_TYPES = new Set(["select", "with"]);
const ALLOWED_WRITE_TYPES = new Set(["insert", "update", "delete", "with"]);

// RLS reads the caller's identity from the request.jwt.claims setting, and the
// role from the role setting. A query able to call set_config() could rewrite
// either mid-statement and act as another user, so it is never allowed.
const FORBIDDEN_FUNCTIONS = new Set(["set_config"]);

function findForbiddenCall(stmts: Statement[]): string | null {
  let found: string | null = null;
  const visitor = astVisitor((map) => ({
    call: (call) => {
      if (FORBIDDEN_FUNCTIONS.has(call.function.name.toLowerCase())) {
        found = call.function.name;
      }
      map.super().call(call);
    },
  }));
  for (const stmt of stmts) visitor.statement(stmt);
  return found;
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
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // pgsql-ast-parser appends a parse-table dump that is useless to the
    // LLM and consumes many tokens; keep the diagnostic prefix only.
    const message = raw.split("Here is the state of my parse table")[0].trim();
    return `Failed to parse SQL: ${message}`;
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
  const forbiddenCall = findForbiddenCall(stmts);
  if (forbiddenCall) {
    return `Function "${forbiddenCall}" is not allowed.`;
  }
  return null;
}

export function validateWrite(sql: string): string | null {
  let stmts: Statement[];
  try {
    stmts = parse(sql);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // pgsql-ast-parser appends a parse-table dump that is useless to the
    // LLM and consumes many tokens; keep the diagnostic prefix only.
    const message = raw.split("Here is the state of my parse table")[0].trim();
    return `Failed to parse SQL: ${message}`;
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
  const forbiddenCall = findForbiddenCall(stmts);
  if (forbiddenCall) {
    return `Function "${forbiddenCall}" is not allowed.`;
  }
  return null;
}

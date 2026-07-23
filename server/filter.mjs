// Translate the app's PostgREST-style filter objects into a SQLite WHERE clause.
//
// Supported key shapes (as emitted by the CRM's list/filter components):
//   "field"           -> field = ?        (or IN (...) when value is an array)
//   "field@eq|neq|lt|lte|gt|gte" -> field <op> ?
//   "field@is"        -> field IS NULL / IS 0 / IS 1 / IS ?
//   "field@not.is"    -> field IS NOT ...
//   "field@in"        -> value "(1,2,3)" -> field IN (?,?,?)
//   "field@cs"        -> value "{5}"     -> JSON-array-contains-all
//   "field@ilike"     -> field LIKE '%'||?||'%'  (case-insensitive substring)
//   "@or"             -> value { "a@ilike": q, "b@ilike": q } -> (a OR b OR ...)
//
// All values are parameterized (`?`); identifiers are validated + quoted.

const OP = { eq: "=", neq: "!=", lt: "<", lte: "<=", gt: ">", gte: ">=" };

/** Validate + double-quote a SQL identifier (defends against injection). */
export function quoteId(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

// Replicates the frontend listParser: "1,2,\"a,b\"" -> [1, 2, "a,b"], numbers
// parsed where possible.
function parseList(list) {
  const items = [];
  let current = "";
  let quoted = false;
  for (const char of list) {
    if (char === "," && !quoted) {
      items.push(current);
      current = "";
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    current += char;
  }
  if (current) items.push(current);
  return items.map((v) => {
    const n = Number.parseFloat(v);
    return Number.isNaN(n) ? v : n;
  });
}

/** "(1,2,3)" | [1,2] | 3 -> [1,2,3] */
function toList(value, open, close) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === `${open}${close}`) return [];
    if (trimmed.startsWith(open) && trimmed.endsWith(close)) {
      return parseList(trimmed.slice(1, -1));
    }
  }
  return [value];
}

function toBool(v) {
  return v === true || v === 1 || v === "true" || v === "1" ? 1 : 0;
}

/** Build a single condition -> { sql, args } | null. */
function condition(key, value, cfg) {
  if (value === undefined) return null;

  if (key === "@or" || key.endsWith("@or")) {
    const parts = [];
    const args = [];
    for (const [k, v] of Object.entries(value ?? {})) {
      const c = condition(k, v, cfg);
      if (c) {
        parts.push(c.sql);
        args.push(...c.args);
      }
    }
    return parts.length ? { sql: `(${parts.join(" OR ")})`, args } : null;
  }

  const at = key.lastIndexOf("@");
  const field = at === -1 ? key : key.slice(0, at);
  const op = at === -1 ? "eq" : key.slice(at + 1);
  const col = quoteId(field);
  const isBool = cfg?.bool?.includes(field);
  const coerce = (v) => (isBool ? toBool(v) : v);

  if (op in OP) {
    if (op === "eq" && Array.isArray(value)) {
      if (value.length === 0) return { sql: "0 = 1", args: [] };
      const ph = value.map(() => "?").join(",");
      return { sql: `${col} IN (${ph})`, args: value.map(coerce) };
    }
    return { sql: `${col} ${OP[op]} ?`, args: [coerce(value)] };
  }

  switch (op) {
    case "is":
      if (value === null) return { sql: `${col} IS NULL`, args: [] };
      if (typeof value === "boolean")
        return { sql: `${col} IS ${value ? 1 : 0}`, args: [] };
      return { sql: `${col} IS ?`, args: [coerce(value)] };
    case "not.is":
      if (value === null) return { sql: `${col} IS NOT NULL`, args: [] };
      if (typeof value === "boolean")
        return { sql: `${col} IS NOT ${value ? 1 : 0}`, args: [] };
      return { sql: `${col} IS NOT ?`, args: [coerce(value)] };
    case "in": {
      const list = toList(value, "(", ")");
      if (list.length === 0) return { sql: "0 = 1", args: [] };
      const ph = list.map(() => "?").join(",");
      return { sql: `${col} IN (${ph})`, args: list.map(coerce) };
    }
    case "cs": {
      // JSON-array column contains ALL of the given values.
      const list = toList(value, "{", "}");
      if (list.length === 0) return null;
      const parts = list.map(
        () =>
          `EXISTS (SELECT 1 FROM json_each(${col}) WHERE json_each.value = ?)`,
      );
      return { sql: `(${parts.join(" AND ")})`, args: list };
    }
    case "ilike":
      return { sql: `${col} LIKE '%' || ? || '%'`, args: [String(value)] };
    default:
      // Unknown operator: fall back to equality on the base field.
      return { sql: `${col} = ?`, args: [coerce(value)] };
  }
}

/** Build the full WHERE clause (AND-combined) -> { sql, args }. */
export function buildWhere(filter, cfg, extra = []) {
  const clauses = [];
  const args = [];
  for (const [key, value] of Object.entries(filter ?? {})) {
    if (key === "q") continue; // full-text search is expanded to @or upstream
    const c = condition(key, value, cfg);
    if (c) {
      clauses.push(c.sql);
      args.push(...c.args);
    }
  }
  for (const c of extra) {
    clauses.push(c.sql);
    args.push(...c.args);
  }
  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    args,
  };
}

// CRUD + list query builders over libSQL, matching the react-admin DataProvider
// method surface. Rows are (de)serialized per the resource's json/bool columns.
import { db, tableColumns } from "./db.mjs";
import { buildWhere, quoteId } from "./filter.mjs";
import { CASCADE, RESOURCES } from "./resources.mjs";

/** libSQL rows are array-like; build plain {col: value} objects reliably. */
function toObjects(result) {
  const { columns, rows } = result;
  return rows.map((r) => {
    const o = {};
    columns.forEach((c, i) => {
      o[c] = r[i];
    });
    return o;
  });
}

function serializeRow(cfg, row) {
  if (!row) return row;
  for (const k of cfg.json) {
    if (typeof row[k] === "string") {
      try {
        row[k] = JSON.parse(row[k]);
      } catch {
        /* leave the raw string if it isn't valid JSON */
      }
    }
  }
  for (const k of cfg.bool) {
    if (row[k] !== null && row[k] !== undefined) {
      row[k] = row[k] === 1 || row[k] === true;
    }
  }
  return row;
}

const serialize = (cfg, rows) => rows.map((r) => serializeRow(cfg, r));

function coerceId(id) {
  return /^\d+$/.test(String(id)) ? Number(id) : id;
}

/** Turn an incoming write payload into { columns, values } for known columns. */
function prepareWrite(cfg, data) {
  const known = new Set(tableColumns[cfg.table] ?? []);
  const columns = [];
  const values = [];
  for (const [key, raw] of Object.entries(data ?? {})) {
    if (key === "id" || !known.has(key)) continue;
    let value = raw;
    if (cfg.json.includes(key)) {
      value = raw === null || raw === undefined ? null : JSON.stringify(raw);
    } else if (cfg.bool.includes(key)) {
      value = raw === true || raw === 1 || raw === "true" ? 1 : 0;
    } else if (value === undefined) {
      value = null;
    }
    columns.push(key);
    values.push(value);
  }
  return { columns, values };
}

function orderBy(sort) {
  const s = Array.isArray(sort) ? sort[0] : sort;
  if (!s?.field) return 'ORDER BY "id" ASC';
  const col = quoteId(s.field);
  const dir = String(s.order).toUpperCase() === "DESC" ? "DESC" : "ASC";
  // Mirror the previous "desc.nullslast" ordering.
  return dir === "DESC"
    ? `ORDER BY ${col} DESC NULLS LAST`
    : `ORDER BY ${col} ASC`;
}

function limitOffset(pagination) {
  const page = Number(pagination?.page ?? 1);
  const perPage = Number(pagination?.perPage ?? 25);
  return { limit: perPage, offset: (page - 1) * perPage };
}

function assertWritable(cfg) {
  if (cfg.readonly) {
    throw new Error(`Resource "${cfg.table}" is read-only`);
  }
}

async function listWith(cfg, { filter, sort, pagination }, extra = []) {
  const where = buildWhere(filter, cfg, extra);
  const table = quoteId(cfg.table);

  const totalRes = await db.execute({
    sql: `SELECT count(*) AS n FROM ${table} ${where.sql}`,
    args: where.args,
  });
  const total = Number(toObjects(totalRes)[0].n);

  const { limit, offset } = limitOffset(pagination);
  const dataRes = await db.execute({
    sql: `SELECT * FROM ${table} ${where.sql} ${orderBy(sort)} LIMIT ? OFFSET ?`,
    args: [...where.args, limit, offset],
  });
  return { data: serialize(cfg, toObjects(dataRes)), total };
}

export function getList(cfg, params) {
  return listWith(cfg, params);
}

export function getManyReference(cfg, params) {
  const extra = [
    { sql: `${quoteId(params.target)} = ?`, args: [coerceId(params.id)] },
  ];
  return listWith(cfg, params, extra);
}

export async function getOne(cfg, { id }) {
  const res = await db.execute({
    sql: `SELECT * FROM ${quoteId(cfg.table)} WHERE "id" = ?`,
    args: [coerceId(id)],
  });
  const rows = serialize(cfg, toObjects(res));
  if (rows.length === 0) throw new Error(`${cfg.table} #${id} not found`);
  return { data: rows[0] };
}

export async function getMany(cfg, { ids }) {
  const list = (ids ?? []).map(coerceId);
  if (list.length === 0) return { data: [] };
  const ph = list.map(() => "?").join(",");
  const res = await db.execute({
    sql: `SELECT * FROM ${quoteId(cfg.table)} WHERE "id" IN (${ph})`,
    args: list,
  });
  return { data: serialize(cfg, toObjects(res)) };
}

export async function create(cfg, { data }) {
  assertWritable(cfg);
  const { columns, values } = prepareWrite(cfg, data);
  const table = quoteId(cfg.table);
  const sql =
    columns.length === 0
      ? `INSERT INTO ${table} DEFAULT VALUES RETURNING *`
      : `INSERT INTO ${table} (${columns.map(quoteId).join(",")}) VALUES (${columns
          .map(() => "?")
          .join(",")}) RETURNING *`;
  const res = await db.execute({ sql, args: values });
  return { data: serialize(cfg, toObjects(res))[0] };
}

export async function update(cfg, { id, data }) {
  assertWritable(cfg);
  const { columns, values } = prepareWrite(cfg, data);
  if (columns.length === 0) return getOne(cfg, { id });
  const assignments = columns.map((c) => `${quoteId(c)} = ?`).join(",");
  const res = await db.execute({
    sql: `UPDATE ${quoteId(cfg.table)} SET ${assignments} WHERE "id" = ? RETURNING *`,
    args: [...values, coerceId(id)],
  });
  const rows = serialize(cfg, toObjects(res));
  if (rows.length === 0) throw new Error(`${cfg.table} #${id} not found`);
  return { data: rows[0] };
}

export async function updateMany(cfg, { ids, data }) {
  assertWritable(cfg);
  const list = (ids ?? []).map(coerceId);
  const { columns, values } = prepareWrite(cfg, data);
  if (list.length === 0 || columns.length === 0) return { data: list };
  const assignments = columns.map((c) => `${quoteId(c)} = ?`).join(",");
  const ph = list.map(() => "?").join(",");
  await db.execute({
    sql: `UPDATE ${quoteId(cfg.table)} SET ${assignments} WHERE "id" IN (${ph})`,
    args: [...values, ...list],
  });
  return { data: list };
}

/** Recursively delete child rows for the ON DELETE CASCADE relationships. */
async function cascadeDelete(table, ids) {
  const children = CASCADE[table];
  if (!children || ids.length === 0) return;
  const ph = ids.map(() => "?").join(",");
  for (const [childTable, fk] of children) {
    const res = await db.execute({
      sql: `SELECT "id" FROM ${quoteId(childTable)} WHERE ${quoteId(fk)} IN (${ph})`,
      args: ids,
    });
    const childIds = toObjects(res).map((r) => r.id);
    if (childIds.length === 0) continue;
    await cascadeDelete(childTable, childIds);
    const cph = childIds.map(() => "?").join(",");
    await db.execute({
      sql: `DELETE FROM ${quoteId(childTable)} WHERE "id" IN (${cph})`,
      args: childIds,
    });
  }
}

export async function del(cfg, { id }) {
  assertWritable(cfg);
  const realId = coerceId(id);
  await cascadeDelete(cfg.table, [realId]);
  const res = await db.execute({
    sql: `DELETE FROM ${quoteId(cfg.table)} WHERE "id" = ? RETURNING *`,
    args: [realId],
  });
  return { data: serialize(cfg, toObjects(res))[0] ?? { id: realId } };
}

export async function deleteMany(cfg, { ids }) {
  assertWritable(cfg);
  const list = (ids ?? []).map(coerceId);
  if (list.length === 0) return { data: [] };
  await cascadeDelete(cfg.table, list);
  const ph = list.map(() => "?").join(",");
  await db.execute({
    sql: `DELETE FROM ${quoteId(cfg.table)} WHERE "id" IN (${ph})`,
    args: list,
  });
  return { data: list };
}

export const HANDLERS = {
  getList,
  getOne,
  getMany,
  getManyReference,
  create,
  update,
  updateMany,
  delete: del,
  deleteMany,
};

export { RESOURCES };

import {
  COUNTERPARTY_KINDS,
  COUNTERPARTY_ROLES,
  type CounterpartyKind,
  type CounterpartyRole,
} from "../counterparties/counterpartyOptions";
import { toInteger, toText } from "./parseCell";
import type { ImportCell, ImportRow } from "./types";

/** Requisite columns a counterparty CSV may carry (keys of the country packs). */
export const REQUISITE_COLUMNS = ["edrpou", "ipn", "iban", "nip", "regon"];

const ROLE_WORDS: Record<string, CounterpartyRole> = {
  клієнт: "client",
  постачальник: "supplier",
  партнер: "partner",
};
const KIND_WORDS: Record<string, CounterpartyKind> = {
  компанія: "company",
  фоп: "sole_proprietor",
  "фізична особа": "person",
  "sole proprietor": "sole_proprietor",
};

/** "client;supplier" or "клієнт, постачальник" → ["client", "supplier"]. */
export const toRoles = (cell: ImportCell): CounterpartyRole[] => {
  const roles = (toText(cell)?.split(/[;,]/) ?? [])
    .map((word) => word.trim().toLowerCase())
    .map((word) =>
      (COUNTERPARTY_ROLES as readonly string[]).includes(word)
        ? (word as CounterpartyRole)
        : ROLE_WORDS[word],
    )
    .filter((role): role is CounterpartyRole => role !== undefined);
  return roles.length ? Array.from(new Set(roles)) : ["client"];
};

export const toCounterpartyKind = (cell: ImportCell): CounterpartyKind => {
  const word = toText(cell)?.toLowerCase() ?? "";
  return (COUNTERPARTY_KINDS as readonly string[]).includes(word)
    ? (word as CounterpartyKind)
    : (KIND_WORDS[word] ?? "company");
};

/**
 * The counterparty fields of a company CSV row: kind, roles, country,
 * requisites of that country, VAT ID and terms. The database checks the
 * requisites against the country pack and refuses a row with a wrong number.
 */
export const toCounterparty = (row: ImportRow) => {
  const requisites = Object.fromEntries(
    REQUISITE_COLUMNS.map((key) => [key, toText(row[key])]).filter(
      ([, value]) => value !== undefined,
    ),
  );
  return {
    kind: toCounterpartyKind(row.kind),
    roles: toRoles(row.roles),
    country_code: toText(row.country_code)?.toUpperCase() ?? null,
    requisites,
    vat_id: toText(row.vat_id) ?? null,
    currency: toText(row.currency)?.toUpperCase() ?? null,
    payment_terms_days: toInteger(row.payment_terms_days) ?? null,
  };
};

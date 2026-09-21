import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// handle_deal_won() must never lose SECURITY DEFINER again.
//
// 20260921100000 is the live production repair for
//
//   42501 permission denied for function seed_enrollment_onboarding
//
// which had stopped every paid sale creating its Enrollment. The trigger is
// elevated so it can call a function that stays locked to clients.
//
// The danger is not somebody deliberately undoing that. It is somebody
// redefining the function for an unrelated reason — adding a column to the
// Enrollment insert, say — by pasting the body from an older copy. A
// migration that applies LATER wins, so the repair would vanish at deploy
// time with nothing failing. That very nearly happened when the Capacity
// branch was brought back onto main: 20260921130000 redefines this function
// and sits after the hotfix.
//
// So every migration that defines it is checked, not just the newest.
const MIGRATIONS = "supabase/migrations";

// The version that introduced the repair. Migrations BEFORE it define the
// function without SECURITY DEFINER and are correct to — that is simply
// what the function was then, and history is not rewritten here. Only a
// migration at or after this version can revert the fix, because only a
// later one wins.
const REPAIRED_AT = "20260921100000";

const definingMigrations = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => f.slice(0, 14) >= REPAIRED_AT)
  .map((file) => ({ file, sql: readFileSync(`${MIGRATIONS}/${file}`, "utf8") }))
  .filter(({ sql }) =>
    /create or replace function public\.handle_deal_won/i.test(sql),
  );

describe("the Won privilege repair survives every redefinition", () => {
  test("the repair itself is among the migrations checked", () => {
    // If this ever hits zero the filter above has silently stopped
    // protecting anything.
    expect(definingMigrations.map((m) => m.file)).toContain(
      "20260921100000_winning_a_sale_must_not_need_checklist_rights.sql",
    );
  });

  test.each(definingMigrations.map(({ file }) => file))(
    "%s defines it as SECURITY DEFINER",
    (file) => {
      const sql = readFileSync(`${MIGRATIONS}/${file}`, "utf8");
      // The header runs from the CREATE line to the AS $function$ body.
      const header = sql.slice(
        sql.search(/create or replace function public\.handle_deal_won/i),
        sql.search(/AS \$function\$/i),
      );
      expect(header).toMatch(/SECURITY DEFINER/i);
      // And search_path stays pinned, which is what makes elevation safe.
      expect(header).toMatch(/SET search_path TO 'public'/i);
    },
  );

  test("the declarative schema agrees", () => {
    // The schema is what a rebuild-from-empty produces, so it has to carry
    // the repair too or a clean room would be born broken.
    const schema = readFileSync("supabase/schemas/02_functions.sql", "utf8");
    const start = schema.search(
      /create or replace function public\.handle_deal_won/i,
    );
    const header = schema.slice(start, schema.indexOf("AS $function$", start));
    expect(header).toMatch(/SECURITY DEFINER/i);
    expect(header).toMatch(/SET search_path TO 'public'/i);
  });

  test("seed_enrollment_onboarding is never handed to a client role", () => {
    // The other half of the repair: the trigger is elevated precisely so
    // the callee can stay locked. A grant here would undo the reason.
    for (const { file, sql } of readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .map((file) => ({
        file,
        sql: readFileSync(`${MIGRATIONS}/${file}`, "utf8"),
      }))) {
      const statements = sql
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n");
      expect(
        statements,
        `${file} grants EXECUTE on seed_enrollment_onboarding to a client role`,
      ).not.toMatch(
        /grant\s+execute\s+on\s+function\s+public\.seed_enrollment_onboarding[^;]*(anon|authenticated|service_role)/i,
      );
    }
  });
});

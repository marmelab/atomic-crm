// @vitest-environment node
import { describe, expect, it } from "vitest";

// @ts-expect-error — a .mjs script with no type declarations; it is the
// thing under test, not a typed module.
import { parseJsonFrom } from "../../scripts/salesCallSchemaContract.mjs";

// The failure this guards is small and cost a week.
//
// e2e/salesCallWriteContracts.spec.ts shells out to
// scripts/salesCallSchemaContract.mjs to read the clean room's live
// schema. The script used to do JSON.parse(raw.slice(raw.indexOf("{"))).
// When stdout carries no JSON, indexOf returns -1, slice(-1) hands back
// the trailing newline, and JSON.parse says "Unexpected end of JSON
// input" — naming neither the command nor what it actually printed.
//
// That is precisely what happened on the GitHub runner: `supabase db
// query` exited 0 having printed only "Connecting to local database...",
// because the CLI is pinned nowhere and CI resolved a version whose
// stdout differs. The e2e job went red, the message said nothing, and
// local runs were green throughout.
//
// The structural fix is elsewhere — the clean room is now read through
// the same docker/psql path cleanRoomBootstrap.mjs already uses, so there
// is no CLI stdout format to depend on. This holds the other half: when a
// command does produce nothing usable, the error has to say so out loud.
describe("schema-contract reader: no JSON is an explicit failure", () => {
  it("parses JSON that is preceded by chatter", () => {
    expect(
      parseJsonFrom('Connecting to local database...\n{"rows":[1]}', "probe"),
    ).toEqual({ rows: [1] });
  });

  it("names the command and echoes what it printed when there is no JSON", () => {
    expect(() =>
      parseJsonFrom("Connecting to local database...\n", "supabase db query"),
    ).toThrow(/supabase db query produced no JSON/);
    expect(() =>
      parseJsonFrom("Connecting to local database...\n", "supabase db query"),
    ).toThrow(/Connecting to local database/);
  });

  it("says so for empty output rather than throwing a parser error", () => {
    expect(() => parseJsonFrom("", "psql")).toThrow(/psql produced no JSON/);
    expect(() => parseJsonFrom("", "psql")).toThrow(/\(nothing\)/);
  });

  it("does not mistake a brace in prose for a payload", () => {
    expect(() =>
      parseJsonFrom("error: unexpected { near line 2", "psql"),
    ).toThrow(/produced no JSON/);
  });
});

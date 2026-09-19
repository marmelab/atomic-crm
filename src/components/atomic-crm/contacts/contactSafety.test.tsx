import { RecordContextProvider } from "ra-core";
import { render } from "vitest-browser-react";

import { StoryWrapper } from "@/test/StoryWrapper";
import { createDataProvider } from "../providers/fakerest";
import { ContactMergeButton } from "./ContactMergeButton";
import {
  CONTACT_FK_DELETE_RULES,
  CONTACT_MERGE_DISABLED_CODE,
  CONTACT_DELETE_DISABLED_CODE,
  type ContactDeleteRule,
} from "./contactSafety";
import type { Contact } from "../types";

// Slice 0 safety rails.
//
// Audit #6 found that merging one Contact into another repointed three
// tables and then deleted the loser, taking its sales calls, client
// sessions, Stripe identities and waitlist entries with it through the
// foreign keys. Ordinary Contact deletion did the same thing with no
// merge involved. Both are closed until Slice 5 builds a merge that moves
// every dependent table in one transaction.

const contact = {
  id: 1,
  first_name: "Test",
  last_name: "Person",
  email_jsonb: [],
  phone_jsonb: [],
  tags: [],
} as unknown as Contact;

describe("the merge affordance cannot invoke a merge", () => {
  it("offers the action, disabled, and says why", async () => {
    // Arrange / Act
    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <RecordContextProvider value={contact}>
          <ContactMergeButton />
        </RecordContextProvider>
      </StoryWrapper>,
    );

    // Assert — it must not silently disappear, and it must not pretend.
    const button = screen.getByRole("button", {
      name: /merge with another contact/i,
    });
    await expect.element(button).toBeVisible();
    await expect.element(button).toBeDisabled();
    await expect
      .element(screen.getByText(/temporarily unavailable/i))
      .toBeVisible();
  });

  it("renders no way to choose a contact to merge into", async () => {
    // Arrange / Act — the dialog is gone, not merely closed: offering to
    // pick a target for an operation that cannot run is its own lie.
    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <RecordContextProvider value={contact}>
          <ContactMergeButton />
        </RecordContextProvider>
      </StoryWrapper>,
    );

    // Assert
    expect(screen.container.textContent).not.toMatch(/will be deleted/i);
    expect(screen.container.querySelector("input")).toBeNull();
  });
});

describe("the data provider refuses, whoever calls it", () => {
  const provider = () => createDataProvider() as any;

  it("refuses a merge instead of resolving", async () => {
    // Arrange / Act / Assert
    await expect(provider().mergeContacts(1, 2)).rejects.toMatchObject({
      code: CONTACT_MERGE_DISABLED_CODE,
    });
  });

  it("refuses to delete a contact", async () => {
    // Arrange / Act / Assert
    await expect(
      provider().delete("contacts", { id: 1, previousData: contact }),
    ).rejects.toMatchObject({ code: CONTACT_DELETE_DISABLED_CODE });
  });

  it("refuses to delete contacts in bulk", async () => {
    // Arrange / Act / Assert
    await expect(
      provider().deleteMany("contacts", { ids: [1, 2] }),
    ).rejects.toMatchObject({ code: CONTACT_DELETE_DISABLED_CODE });
  });

  it("still deletes everything that is not a contact", async () => {
    // Arrange — the rail is about Contacts, not about deletion generally.
    // Assert
    await expect(
      provider().deleteMany("tasks", { ids: [] }),
    ).resolves.toBeDefined();
  });
});

// The repo's SQL, read at test time. A future schema change that widens
// the blast radius — a new table pointing at contacts, or a NO ACTION
// quietly turned into CASCADE — fails here rather than in production.
const SQL_SOURCES = import.meta.glob("/supabase/**/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Every FK pointing at public.contacts, as (table, on delete) pairs. */
const declaredContactForeignKeys = (): Map<string, Set<ContactDeleteRule>> => {
  const found = new Map<string, Set<ContactDeleteRule>>();
  const reference = /references\s+"?public"?\s*\.\s*"?contacts"?\s*\(/gi;

  for (const source of Object.values(SQL_SOURCES)) {
    let match: RegExpExecArray | null;
    reference.lastIndex = 0;
    while ((match = reference.exec(source)) !== null) {
      // The owning table is the nearest CREATE TABLE or ALTER TABLE above.
      const before = source.slice(0, match.index);
      const owner = [
        ...before.matchAll(
          /(?:create|alter)\s+table\s+(?:if\s+not\s+exists\s+|only\s+)?"?public"?\s*\.\s*"?([a-z_]+)"?/gi,
        ),
      ].pop();
      if (!owner) continue;

      // The clause runs to the end of this constraint definition.
      const clause = source.slice(match.index, match.index + 200);
      const rule: ContactDeleteRule = /on\s+delete\s+cascade/i.test(
        clause.split(/[;,]\s*\n/)[0],
      )
        ? "CASCADE"
        : "NO ACTION";

      const table = owner[1].toLowerCase();
      if (!found.has(table)) found.set(table, new Set());
      found.get(table)!.add(rule);
    }
  }
  return found;
};

describe("the contact delete-rule map is what the schema actually says", () => {
  it("finds the foreign keys it is supposed to find", () => {
    // Arrange — a parser that silently matched nothing would pass every
    // assertion below, so prove it actually read the schema first.
    const declared = declaredContactForeignKeys();

    // Assert — every recorded table is one the parser located for itself.
    expect([...declared.keys()].sort()).toEqual(
      Object.keys(CONTACT_FK_DELETE_RULES).sort(),
    );
    expect(declared.get("deals")).toContain("CASCADE");
    expect(declared.get("applications")).toContain("NO ACTION");
  });

  it("knows about every table that points at a contact", () => {
    // Arrange
    const declared = declaredContactForeignKeys();

    // Act
    const undocumented = [...declared.keys()].filter(
      (table) => !(table in CONTACT_FK_DELETE_RULES),
    );

    // Assert — a new dependent table has to be considered deliberately.
    expect(undocumented).toEqual([]);
  });

  it("records the same ON DELETE rule the SQL declares", () => {
    // Arrange
    const declared = declaredContactForeignKeys();

    // Act — a table whose rule changed over time declares both, and the
    // recorded rule must be among them.
    const disagreements = [...declared.entries()]
      .filter(([table]) => table in CONTACT_FK_DELETE_RULES)
      .filter(([table, rules]) => !rules.has(CONTACT_FK_DELETE_RULES[table]))
      .map(([table, rules]) => `${table}: SQL says ${[...rules].join("/")}`);

    // Assert
    expect(disagreements).toEqual([]);
  });

  it("declares no permissive delete policy or grant for contacts", () => {
    // Arrange — the database rails from 20260918330000. Reintroducing
    // either of these in the declarative schema would quietly reopen the
    // cascade that Slice 0 closed.
    const policies = SQL_SOURCES["/supabase/schemas/05_policies.sql"];
    const grants = SQL_SOURCES["/supabase/schemas/06_grants.sql"];

    // Assert — the parser read the right files.
    expect(policies).toMatch(/create policy .* on public\.contacts for select/);
    expect(grants).toMatch(/public\.contacts/);

    // No delete policy on contacts.
    expect(policies).not.toMatch(
      /create policy[^\n]*on public\.contacts for delete/i,
    );
    // No route back to the merge primitive for a browser-reachable role.
    expect(grants).not.toMatch(
      /grant[^\n]*merge_contacts[^\n]*to (anon|authenticated|public)/i,
    );
    expect(grants).toMatch(
      /revoke delete on table public\.contacts from authenticated/i,
    );
  });

  it("keeps the snapshot store unreachable from the browser", () => {
    // Arrange — the declarative schema is what a clean-room rebuild
    // reconstructs, so the lockdown has to be expressed HERE and not only
    // in the migration that first applied it. This repo has already had to
    // fix grant drift twice.
    const grants = SQL_SOURCES["/supabase/schemas/06_grants.sql"];
    const policies = SQL_SOURCES["/supabase/schemas/05_policies.sql"];

    // Assert — revoked from every role a signed-in browser can become,
    // service_role included: it bypasses RLS, so a grant there would undo
    // the lock rather than narrow it.
    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      expect(grants).toContain(
        `revoke all on table public.historical_application_source_snapshots from ${role};`,
      );
    }
    // And nothing grants it back.
    expect(grants).not.toMatch(
      /grant[^\n]*historical_application_source_snapshots[^\n]*to (anon|authenticated|service_role)/i,
    );
    // RLS with zero policies is the second, independent lock.
    expect(policies).not.toMatch(
      /on public\.historical_application_source_snapshots/i,
    );
  });

  it("keeps the merge primitive callable by nobody the browser can become", () => {
    // Arrange
    const grants = SQL_SOURCES["/supabase/schemas/06_grants.sql"];

    // Assert — PUBLIC first, because a function with no ACL defaults to
    // EXECUTE for PUBLIC and revoking the named roles alone changes
    // nothing.
    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      expect(grants).toContain(
        `revoke all on function public.merge_contacts(bigint, bigint) from ${role};`,
      );
    }
  });

  it("still names the tables a contact delete would destroy", () => {
    // Arrange — the live rules read from MAIN during the Slice 0 audit.
    // Assert
    expect(CONTACT_FK_DELETE_RULES).toEqual({
      applications: "NO ACTION",
      client_sessions: "CASCADE",
      contact_notes: "CASCADE",
      contact_stripe_customers: "CASCADE",
      deals: "CASCADE",
      sales_calls: "CASCADE",
      tasks: "CASCADE",
      waitlist_entries: "CASCADE",
      waitlist_invitations: "NO ACTION",
    });
  });
});

import { test as base, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341",
  process.env.SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Tables in FK-safe deletion order (children before parents)
const TABLES = [
  "tasks",
  "contact_notes",
  "deal_notes",
  "deals",
  "contacts",
  "companies",
  "tags",
  "favicons_excluded_domains",
  "configuration",
  "sales",
];

async function resetDb() {
  console.log("Resetting database...");
  for (const table of TABLES) {
    // Supabase client delete need a where clause to get executed, so we use one that will match on all rows (id is not null)
    await adminSupabase.from(table).delete().not("id", "is", null);
  }

  // Delete all auth users (cascades to sales via DB trigger)
  const { data } = await adminSupabase.auth.admin.listUsers();
  console.log("auth users", { data });
  await Promise.all(
    data.users.map((user) => adminSupabase.auth.admin.deleteUser(user.id)),
  );

  console.log("Database reset success");
}

export const test = base.extend<{ resetDb: void }>({
  resetDb: [
    // The first argument to a Playwright fixture function must use object destructuring ({}) — _ is not allowed.
    // Playwright uses this to statically analyze which fixtures are requested.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await resetDb();
      await use();
    },
    { auto: true },
  ],
});

export { expect };

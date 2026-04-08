import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341";
const serviceRoleKey = process.env.SERVICE_ROLE_KEY!;

if (!serviceRoleKey) {
  throw new Error(
    "SERVICE_ROLE_KEY is required for integration tests. Set it in .env.e2e",
  );
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Tables in FK-safe deletion order (children before parents)
const CLEANUP_TABLES = [
  "integration_log",
  "n8n_workflow_runs",
  "audit_reports",
  "audit_results",
  "deal_contacts",
  "contact_tags",
  "tasks",
  "contact_notes",
  "deal_notes",
  "deals",
  "contacts",
  "companies",
  "tags",
];

export async function cleanupTestData() {
  for (const table of CLEANUP_TABLES) {
    await supabase.from(table).delete().not("id", "is", null);
  }
}

export async function createTestUser() {
  const email = `test-${Date.now()}@integration.test`;
  const password = "test-password-123";

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw new Error(`Failed to create test user: ${error.message}`);

  // Wait for the sales trigger to fire
  await new Promise((r) => setTimeout(r, 500));

  const { data: sales } = await supabase
    .from("sales")
    .select("id")
    .eq("user_id", data.user.id)
    .single();

  return { userId: data.user.id, salesId: sales!.id, email };
}

export async function deleteTestUser(userId: string) {
  await supabase.auth.admin.deleteUser(userId);
}

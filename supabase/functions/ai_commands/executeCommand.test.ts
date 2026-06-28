import { describe, expect, it } from "vitest";
import { executeCommand, type SupabaseLike } from "./executeCommand";

const createSupabaseStub = ({
  leadResearchers = [{ id: 7, role: "lead_researcher", disabled: false }],
  taskError,
}: {
  leadResearchers?: Array<{
    id: number;
    role: string;
    disabled: boolean;
  }>;
  taskError?: Error;
} = {}) => {
  const inserts: Record<string, unknown>[] = [];

  const supabase = {
    from(table: string) {
      if (table === "sales") {
        return {
          select: () => this.from(table),
          eq: () => this.from(table),
          order: () => this.from(table),
          limit: async () => ({ data: leadResearchers, error: null }),
        };
      }

      if (table === "tasks") {
        return {
          insert: (value: Record<string, unknown>) => {
            inserts.push(value);
            return {
              select: () => ({
                single: async () => ({
                  data: taskError ? null : { id: 99 },
                  error: taskError ?? null,
                }),
              }),
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseLike;

  return { supabase, inserts };
};

describe("executeCommand", () => {
  it("creates a task for the first active lead_researcher", async () => {
    const { supabase, inserts } = createSupabaseStub();

    await expect(
      executeCommand(supabase, {
        id: 12,
        command_type: "create_luke_task",
        payload: {
          title: "Enrich Ada Lovelace",
          contact_id: 42,
          priority: "high",
        },
      }),
    ).resolves.toEqual({
      task_id: 99,
      assigned_to_user_id: 7,
      warnings: undefined,
    });

    expect(inserts[0]).toMatchObject({
      contact_id: 42,
      title: "Enrich Ada Lovelace",
      text: "Enrich Ada Lovelace",
      sales_id: 7,
      source: "ai_command",
      source_command_id: 12,
      priority: "high",
      linked_entity_type: "contact",
      linked_entity_id: 42,
    });
  });

  it("fails when no lead_researcher exists", async () => {
    const { supabase } = createSupabaseStub({ leadResearchers: [] });

    await expect(
      executeCommand(supabase, {
        id: 12,
        command_type: "create_luke_task",
        payload: { title: "Research Acme", contact_id: 42 },
      }),
    ).rejects.toThrow("No lead_researcher user found. Create Luke first.");
  });

  it("rejects an unknown command_type", async () => {
    const { supabase } = createSupabaseStub();

    await expect(
      executeCommand(supabase, {
        id: 12,
        command_type: "delete_all_contacts",
        payload: { title: "Nope", contact_id: 42 },
      }),
    ).rejects.toThrow("Unsupported command_type: delete_all_contacts");
  });
});

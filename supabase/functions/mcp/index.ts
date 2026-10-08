import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createMcpHandler,
  McpServer,
} from "npm:@modelcontextprotocol/server@2.3.1";
import { pipeline } from "npm:@supabase/middleware@1.0.0";
import { withCors } from "npm:@supabase/middleware@1.0.0/cors";
import {
  withOAuthProtectedResource,
  withSupabase,
} from "npm:@supabase/server@1.9.1";
import {
  withPostgresClient,
  type PostgresApi,
} from "npm:@supabase/server@1.9.1/middleware/postgres";
// pg is an optional peer dependency of @supabase/server, required by
// withPostgresClient: importing it puts it in the module graph.
import pg from "npm:pg@8.23.1";
import { z } from "npm:zod@^4.3.6";
import { validateReadOnly, validateWrite } from "./validateSql.ts";
import { TASK_LIST_HTML, TASK_LIST_UI_URI } from "./taskListUi.ts";

const CRM_BASE_URL = (Deno.env.get("CRM_BASE_URL") ?? "").replace(/\/$/, "");

// pg returns int8 (ids, COUNT(*)) as strings. Return numbers instead, so the
// model can pass ids straight back to the tools that expect integers.
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

// --- Database: get_schema ---

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  table_type: string;
}

interface ForeignKeyRow {
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
}

async function getSchemaData(postgres: PostgresApi): Promise<string> {
  // Runs as the caller's role, so information_schema only lists the
  // columns the caller can actually read.
  const columns: ColumnRow[] = await postgres.query`
    SELECT
      c.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      t.table_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position
  `;

  const foreignKeyRows: ForeignKeyRow[] = await postgres.query`
    SELECT
      src.relname AS source_table,
      src_att.attname AS source_column,
      tgt.relname AS target_table,
      tgt_att.attname AS target_column
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class src ON con.conrelid = src.oid
    JOIN pg_catalog.pg_namespace nsp ON src.relnamespace = nsp.oid
    JOIN pg_catalog.pg_class tgt ON con.confrelid = tgt.oid
    JOIN pg_catalog.pg_attribute src_att
      ON src_att.attrelid = con.conrelid AND src_att.attnum = ANY(con.conkey)
    JOIN pg_catalog.pg_attribute tgt_att
      ON tgt_att.attrelid = con.confrelid AND tgt_att.attnum = ANY(con.confkey)
    WHERE con.contype = 'f' AND nsp.nspname = 'public'
    ORDER BY src.relname
  `;

  // Group columns by table
  const tables = new Map<
    string,
    {
      type: string;
      columns: {
        name: string;
        type: string;
        nullable: boolean;
        default: string | null;
      }[];
    }
  >();
  for (const row of columns) {
    if (!tables.has(row.table_name)) {
      tables.set(row.table_name, {
        type: row.table_type === "VIEW" ? "View" : "Table",
        columns: [],
      });
    }
    tables.get(row.table_name)!.columns.push({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === "YES",
      default: row.column_default,
    });
  }

  // Group foreign keys by source table
  const foreignKeys = new Map<
    string,
    { source_column: string; target_table: string; target_column: string }[]
  >();
  for (const row of foreignKeyRows) {
    if (!foreignKeys.has(row.source_table)) {
      foreignKeys.set(row.source_table, []);
    }
    foreignKeys.get(row.source_table)!.push({
      source_column: row.source_column,
      target_table: row.target_table,
      target_column: row.target_column,
    });
  }

  // Format output
  const lines: string[] = [];
  for (const [tableName, table] of tables) {
    lines.push(`${table.type}: ${tableName}`);
    for (const col of table.columns) {
      const parts = [`  - ${col.name}: ${col.type}`];
      if (col.nullable) parts.push("(nullable)");
      if (col.default) parts.push(`default: ${col.default}`);
      lines.push(parts.join(" "));
    }
    const fks = foreignKeys.get(tableName);
    if (fks && fks.length > 0) {
      lines.push("  Foreign Keys:");
      for (const fk of fks) {
        lines.push(
          `    - ${fk.source_column} -> ${fk.target_table}.${fk.target_column}`,
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

// --- Database: LLM-written SQL with RLS ---

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runValidatedSql(
  postgres: PostgresApi,
  sql: string,
  validate: (sql: string) => string | null,
): Promise<
  { success: true; data: unknown[] } | { success: false; error: string }
> {
  // validate() also guarantees a single statement: queryRaw without params
  // uses the simple query protocol, which would otherwise accept a COMMIT
  // that ends the RLS-scoped transaction.
  const validationError = validate(sql);
  if (validationError) {
    return { success: false, error: validationError };
  }
  try {
    return { success: true, data: await postgres.queryRaw(sql) };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

function sqlToolResult(
  result:
    | { success: true; data: unknown[] }
    | { success: false; error: string },
) {
  if (result.success) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  }
  return {
    content: [{ type: "text" as const, text: `Error: ${result.error}` }],
    isError: true,
  };
}

// --- MCP Server Factory ---

function createMcpServer(postgres: PostgresApi, userId: string): McpServer {
  const server = new McpServer({
    name: "atomic-crm",
    version: "1.0.0",
  });

  server.registerTool(
    "get_schema",
    {
      title: "Get Database Schema",
      description:
        "Retrieve the database schema for the user's Atomic CRM instance including all tables, views, columns, types, and foreign key relationships. Views (like contacts_summary, companies_summary) are read-only and provide pre-joined/aggregated data. Use them for search and list queries.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const schema = await getSchemaData(postgres);
      return { content: [{ type: "text" as const, text: schema }] };
    },
  );

  server.registerTool(
    "query",
    {
      title: "Query CRM Data",
      description: `Read data from the user's CRM instance using SQL SELECT queries.

IMPORTANT: Before using this tool, you MUST call the get_schema tool first to understand what tables and columns are available in the database.

Use this tool when the user asks about their CRM data such as:
- Contacts, companies, and deals
- Sales pipeline and forecasting data
- Customer interactions and notes
- Tasks and follow-ups
- Custom fields and metadata

Row Level Security (RLS) is enforced - queries automatically return only data the authenticated user has permission to access.

Use the *_summary views (contacts_summary, companies_summary) for queries that need aggregated data or search capabilities.

To filter by the current user, if the table has a sales_id column, add a WHERE sales_id = auth.uid() clause to your query.

This tool only supports SELECT queries. For INSERT, UPDATE, or DELETE operations, use the mutate tool.

Examples:
- "SELECT id, first_name, last_name, email_fts FROM contacts_summary WHERE email_fts LIKE '%@company.com%'"
- "SELECT name, stage, amount FROM deals WHERE created_at > NOW() - INTERVAL '30 days' ORDER BY amount DESC"
- "SELECT COUNT(*) as total_tasks, type FROM tasks WHERE done_date IS NULL GROUP BY type"
- "SELECT c.first_name, c.last_name, co.name as company_name FROM contacts c JOIN companies co ON c.company_id = co.id WHERE co.sector = 'Technology'"`,
      inputSchema: z.object({
        sql: z.string().describe("The SQL SELECT query to execute"),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ sql }) => {
      // eslint-disable-next-line no-console
      console.log(`[MCP query] user=${userId} sql=${sql}`);
      return sqlToolResult(
        await runValidatedSql(postgres, sql, validateReadOnly),
      );
    },
  );

  server.registerTool(
    "mutate",
    {
      title: "Mutate CRM Data",
      description: `Create, update, or delete data in the user's CRM instance using SQL.

IMPORTANT: Before using this tool, you MUST call the get_schema tool first to understand what tables and columns are available in the database.

Use this tool for data modifications such as:
- Creating new contacts, companies, deals, tasks, or notes
- Updating existing records
- Deleting records

Row Level Security (RLS) is enforced - mutations only affect data the authenticated user has permission to modify.

IMPORTANT: Never specify sales_id in INSERT or UPDATE statements — it is automatically set to the authenticated user by a database trigger.

For read-only queries, use the query tool instead.

Examples:
- "INSERT INTO contacts (first_name, last_name, email) VALUES ('John', 'Doe', 'john@example.com')"
- "UPDATE deals SET stage = 'won-deal' WHERE id = 123"
- "DELETE FROM tasks WHERE id = 456"`,
      inputSchema: z.object({
        sql: z
          .string()
          .describe("The SQL INSERT, UPDATE, or DELETE statement to execute"),
      }),
      annotations: { destructiveHint: true },
    },
    async ({ sql }) => {
      // eslint-disable-next-line no-console
      console.log(`[MCP mutate] user=${userId} sql=${sql}`);
      return sqlToolResult(await runValidatedSql(postgres, sql, validateWrite));
    },
  );

  // --- UI resource for the task-list MCP App ---

  // Inject the CRM base URL into the task-list guest HTML
  // so contact names can link back to the CRM
  const taskListHtml = TASK_LIST_HTML.replace(
    /__CRM_BASE_URL__/g,
    CRM_BASE_URL,
  );

  server.registerResource(
    "task-list-ui",
    TASK_LIST_UI_URI,
    {
      title: "Task List UI",
      description: "Interactive list of tasks with mark-as-done buttons.",
      mimeType: "text/html;profile=mcp-app",
    },
    async (uri: URL) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html;profile=mcp-app",
          text: taskListHtml,
        },
      ],
    }),
  );

  const taskSchema = z.object({
    id: z
      .number()
      .int()
      .describe("Task id — required for the mark-as-done action"),
    text: z.string().nullable().optional().describe("Task description"),
    type: z
      .string()
      .nullable()
      .optional()
      .describe("Task category/type (rendered as a pill)"),
    due_date: z.string().nullable().optional().describe("ISO date string"),
    done_date: z
      .string()
      .nullable()
      .optional()
      .describe("ISO timestamp if already done; null or omitted for pending"),
    contact_name: z
      .string()
      .nullable()
      .optional()
      .describe("Full name of the linked contact, if any"),
    contact_id: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe(
        "Id of the linked contact — used to render the contact name as a link to the CRM contact page",
      ),
  });

  server.registerTool(
    "display_task_list",
    {
      title: "Display Task List",
      description: `Render an array of task rows as an interactive UI (MCP App) where the user can mark each task as done.

This tool is presentational: it does not query the database. Fetch the rows yourself via the query tool (joining contacts for contact_name when useful), then pass them here. Prefer this over replying with a bulleted list of tasks.

Each task should include at least: id (required, used for the mark-as-done action), text, type, due_date, done_date, and optionally contact_name + contact_id (the UI renders the name as a link to the CRM contact page when contact_id is provided).`,
      inputSchema: z.object({
        tasks: z.array(taskSchema).describe("Array of task objects to render"),
      }),
      annotations: { readOnlyHint: true },
      _meta: {
        ui: {
          resourceUri: TASK_LIST_UI_URI,
          visibility: ["model"],
        },
      },
    },
    ({ tasks }) => {
      // eslint-disable-next-line no-console
      console.log(
        `[MCP display_task_list] user=${userId} count=${tasks.length}`,
      );
      // content carries the display text (used by Claude's guest HTML);
      // structuredContent carries the typed data (used by ChatGPT's Apps SDK
      // convention). Supplying both keeps the guest host-agnostic.
      return {
        content: [{ type: "text" as const, text: JSON.stringify(tasks) }],
        structuredContent: { tasks },
      };
    },
  );

  server.registerTool(
    "complete_task",
    {
      title: "Mark Task Done",
      description:
        "Mark a single task as done by id. Used by the task-list UI when the user clicks a task's checkmark, and also callable directly by the model.",
      inputSchema: z.object({
        id: z
          .number()
          .int()
          .positive()
          .describe("The id of the task to mark as done"),
      }),
      annotations: { idempotentHint: true },
      _meta: {
        ui: {
          visibility: ["model", "app"],
        },
      },
    },
    async ({ id }) => {
      // eslint-disable-next-line no-console
      console.log(`[MCP complete_task] user=${userId} id=${id}`);
      try {
        // RETURNING id distinguishes a successful update from an RLS-blocked
        // or non-existent row (both affect 0 rows without an error).
        const rows = await postgres.query`
          UPDATE tasks SET done_date = NOW() WHERE id = ${id} RETURNING id
        `;
        if (rows.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: task ${id} not found or permission denied.`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text" as const, text: `Task ${id} marked as done.` },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${errorMessage(error)}` },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

// --- Request pipeline ---

// withOAuthProtectedResource serves the RFC 9728 metadata and adds the
// WWW-Authenticate challenge to 401s; withSupabase verifies the user's token
// against the project JWKS; withPostgresClient runs every query in a
// transaction scoped to the caller's claims and role, so RLS applies.
Deno.serve(
  pipeline(
    [
      withCors({}),
      withOAuthProtectedResource(),
      withSupabase({ auth: "user" }),
      withPostgresClient(),
    ],
    (req, { postgres, jwtClaims }) => {
      const userId = String(jwtClaims?.sub);
      // A fresh server per request: Edge Functions are stateless
      const handler = createMcpHandler(() => createMcpServer(postgres, userId));
      return handler.fetch(req);
    },
  ),
);

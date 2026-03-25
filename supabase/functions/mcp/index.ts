import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { McpServer } from "npm:@modelcontextprotocol/sdk@1.27.1/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@1.27.1/server/webStandardStreamableHttp.js";
import { createRemoteJWKSet, jwtVerify, decodeJwt } from "npm:jose@5";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { z } from "npm:zod";
import { corsHeaders } from "../_shared/cors.ts";

// --- Environment & Config ---

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_JWT_ISSUER =
  Deno.env.get("SB_JWT_ISSUER") ?? `${SUPABASE_URL}/auth/v1`;

const JWKS = createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

const connectionString =
  Deno.env.get("SUPABASE_DB_URL") ||
  "postgresql://postgres:postgres@db:5432/postgres";
const pool = new Pool(connectionString, 1);

// --- URL Helpers ---

function getBaseUrl(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    // When behind a proxy (ngrok, production), always use HTTPS.
    // x-forwarded-proto may not survive the Supabase gateway chain.
    return `https://${forwardedHost}`;
  }
  const url = new URL(req.url);
  const host = url.host;
  // Supabase edge functions see http:// internally, but are served over HTTPS publicly
  const proto =
    host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

function getResourceMetadataUrl(req: Request): string {
  return `${getBaseUrl(req)}/functions/v1/mcp/oauth-protected-resource`;
}

// --- Auth ---

interface AuthInfo {
  token: string;
  userId: string;
  role?: string;
  clientId?: string;
}

async function validateToken(req: Request): Promise<AuthInfo | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer" || !token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: SUPABASE_JWT_ISSUER,
    });

    if (!payload.sub) return null;

    return {
      token,
      userId: payload.sub,
      role: payload.role as string | undefined,
      clientId: payload.client_id as string | undefined,
    };
  } catch {
    return null;
  }
}

// --- Database: get_schema ---

async function getSchemaData(): Promise<string> {
  const client = await pool.connect();
  try {
    // Query 1: All columns from public schema
    const columnsResult = await client.queryObject<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      table_type: string;
    }>(`
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
    `);

    // Query 2: Foreign key relationships
    const fkResult = await client.queryObject<{
      source_table: string;
      source_column: string;
      target_table: string;
      target_column: string;
    }>(`
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
    `);

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
    for (const row of columnsResult.rows) {
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
    for (const row of fkResult.rows) {
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
  } finally {
    client.release();
  }
}

// --- SQL Validation ---

const ALLOWED_STATEMENTS = /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i;
const BLOCKED_KEYWORDS =
  /\b(DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|VACUUM|REINDEX|CLUSTER|COMMENT|SECURITY\s+LABEL|DO\s*\$|CALL|SET|RESET|LOAD|LISTEN|NOTIFY|UNLISTEN|DISCARD|PREPARE|EXECUTE|DEALLOCATE)\b/i;

function validateDml(sql: string): string | null {
  if (!ALLOWED_STATEMENTS.test(sql)) {
    return "Only SELECT, INSERT, UPDATE, DELETE, and WITH statements are allowed.";
  }
  const match = sql.match(BLOCKED_KEYWORDS);
  if (match) {
    return `Disallowed keyword: ${match[0].toUpperCase()}`;
  }
  return null;
}

// --- Database: query with RLS ---

async function executeQueryWithRLS(
  sql: string,
  userToken: string,
): Promise<
  { success: true; data: unknown[] } | { success: false; error: string }
> {
  const validationError = validateDml(sql);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const client = await pool.connect();
  try {
    const jwtClaims = decodeJwt(userToken);
    const claimsJson = JSON.stringify(jwtClaims).replace(/'/g, "''");

    await client.queryObject("BEGIN");
    await client.queryObject("SET LOCAL role = 'authenticated'");
    await client.queryObject(`SET LOCAL request.jwt.claims = '${claimsJson}'`);

    const result = await client.queryObject(sql);
    await client.queryObject("COMMIT");

    // Convert BigInt values to numbers (Deno Postgres returns bigint for
    // PostgreSQL int8/count results, but JSON.stringify can't handle them)
    const rows = JSON.parse(
      JSON.stringify(result.rows, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value,
      ),
    );
    return { success: true, data: rows };
  } catch (error) {
    try {
      await client.queryObject("ROLLBACK");
    } catch {
      // Ignore rollback errors
    }
    const message =
      error instanceof AggregateError
        ? error.errors.map((e) => e.message).join("; ")
        : error instanceof Error
          ? error.message
          : String(error);
    return { success: false, error: message };
  } finally {
    client.release();
  }
}

// --- MCP Server Factory ---

function createMcpServer(authInfo: AuthInfo): McpServer {
  const server = new McpServer({
    name: "atomic-crm",
    version: "1.0.0",
  });

  server.tool(
    "get_schema",
    "Retrieve the database schema including all tables, views, columns, types, and foreign key relationships. Views (like contacts_summary, companies_summary) are read-only and provide pre-joined/aggregated data. Use them for search and list queries.",
    {},
    async () => {
      const schema = await getSchemaData();
      return { content: [{ type: "text", text: schema }] };
    },
  );

  server.tool(
    "query",
    "Execute a SQL query against the CRM database. The query runs with Row Level Security (RLS) enforced for the authenticated user. Supports SELECT, INSERT, UPDATE, DELETE. Use *_summary views for aggregated/search data. Examples: SELECT id, first_name, last_name FROM contacts_summary WHERE email_fts LIKE '%@company.com%'; SELECT name, stage, amount FROM deals WHERE created_at > NOW() - INTERVAL '30 days' ORDER BY amount DESC",
    { sql: z.string().describe("The SQL query to execute") },
    async ({ sql }) => {
      const result = await executeQueryWithRLS(sql, authInfo.token);
      if (result.success) {
        return {
          content: [
            { type: "text", text: JSON.stringify(result.data, null, 2) },
          ],
        };
      }
      return {
        content: [{ type: "text", text: `Error: ${result.error}` }],
        isError: true,
      };
    },
  );

  return server;
}

// --- OAuth Protected Resource Metadata ---

function handleProtectedResourceMetadata(req: Request): Response {
  const baseUrl = getBaseUrl(req);
  return new Response(
    JSON.stringify({
      resource: `${baseUrl}/functions/v1/mcp`,
      authorization_servers: [`${baseUrl}/auth/v1`],
      bearer_methods_supported: ["header"],
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

// --- MCP Request Handler ---

async function handleMcpRequest(req: Request): Promise<Response> {
  // Validate auth
  const authInfo = await validateToken(req);
  if (!authInfo) {
    const metadataUrl = getResourceMetadataUrl(req);
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl}"`,
      },
    });
  }

  // Create stateless MCP server + transport for this request
  const server = createMcpServer(authInfo);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless
  });

  await server.connect(transport);

  // Clean up server + transport when the connection closes.
  // Do NOT close in a finally block — the SSE response body is a
  // ReadableStream that must remain open until the client consumes it.
  transport.onclose = () => {
    server.close().catch(() => {});
  };

  try {
    return await transport.handleRequest(req);
  } catch (error) {
    console.error("MCP request error:", error);
    await transport.close();
    await server.close();
    return new Response("Internal Server Error", { status: 500 });
  }
}

// --- CORS Helper ---

function withCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// --- Route Dispatcher ---

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // GET /functions/v1/mcp/oauth-protected-resource → RFC 9728 metadata
  if (path.endsWith("/oauth-protected-resource") && req.method === "GET") {
    return withCorsHeaders(handleProtectedResourceMetadata(req));
  }

  // POST/GET/DELETE /functions/v1/mcp → MCP protocol handler
  if (path.endsWith("/mcp") || path.endsWith("/mcp/")) {
    return withCorsHeaders(await handleMcpRequest(req));
  }

  return withCorsHeaders(new Response("Not Found", { status: 404 }));
});

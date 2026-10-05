import type { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import {
  NOTE_ATTACHMENT_CHANGES_SETTING,
  deleteAttachmentsAsUser,
  getRemovedAttachmentPaths,
} from "./attachmentCleanup.ts";

export type QueryWithRLSResult =
  | { success: true; data: unknown[] }
  | { success: false; error: string };

export const runQueryWithRLS = async (
  pool: Pick<Pool, "connect">,
  {
    sql,
    userToken,
    claimsJson,
    isWrite,
  }: {
    sql: string;
    userToken: string;
    claimsJson: string;
    isWrite: boolean;
  },
): Promise<QueryWithRLSResult> => {
  let removedAttachmentPaths: string[] = [];
  const client = await pool.connect();
  try {
    await client.queryObject("BEGIN");
    // set_config(..., is_local=true) is the parameterized equivalent of
    // SET LOCAL — avoids interpolating JWT claims into a SQL string.
    await client.queryObject(
      "SELECT set_config('role', 'authenticated', true)",
    );
    await client.queryObject({
      text: "SELECT set_config('request.jwt.claims', $1, true)",
      args: [claimsJson],
    });
    if (isWrite) {
      await client.queryObject({
        text: "SELECT set_config($1, '[]', true)",
        args: [NOTE_ATTACHMENT_CHANGES_SETTING],
      });
    }

    const result = await client.queryObject(sql);
    const attachmentChanges = isWrite
      ? await client.queryObject<{ setting: string | null }>({
          text: "SELECT current_setting($1, true) AS setting",
          args: [NOTE_ATTACHMENT_CHANGES_SETTING],
        })
      : null;
    await client.queryObject("COMMIT");
    removedAttachmentPaths = getRemovedAttachmentPaths(
      attachmentChanges?.rows[0]?.setting,
    );

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
    await deleteAttachmentsAsUser(removedAttachmentPaths, userToken);
  }
};

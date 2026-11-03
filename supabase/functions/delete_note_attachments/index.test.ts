// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "the-vault-secret";

const { removeFiles, queryDatabase } = vi.hoisted(() => ({
  removeFiles: vi.fn(),
  queryDatabase: vi.fn(),
}));

vi.mock("jsr:@supabase/functions-js/edge-runtime.d.ts", () => ({}));

vi.mock("https://esm.sh/kysely@0.27.2", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    execute: () => queryDatabase(strings.join("$"), values),
  }),
}));

vi.mock("../_shared/db.ts", () => ({ db: {} }));

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    storage: { from: () => ({ remove: removeFiles }) },
  },
}));

let handler: (req: Request) => Promise<Response>;

const deleteRequest = (headers: Record<string, string>) =>
  new Request("http://localhost/functions/v1/delete_note_attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      type: "DELETE",
      old_record: { attachments: [{ path: "0.8262106278726917.pdf" }] },
      record: null,
    }),
  });

describe("delete_note_attachments", () => {
  beforeEach(async () => {
    vi.resetModules();
    removeFiles.mockReset();
    queryDatabase.mockReset();
    removeFiles.mockImplementation(async (paths: string[]) => ({
      data: paths,
      error: null,
    }));
    queryDatabase.mockImplementation(
      async (query: string, values: unknown[]) => {
        if (query.includes("vault.decrypted_secrets")) {
          return { rows: [{ is_valid: values[0] === SECRET }] };
        }
        const names = JSON.parse(values[0] as string) as string[];
        return { rows: names.map((name) => ({ name })) };
      },
    );
    vi.stubGlobal("Deno", {
      env: { get: () => undefined },
      serve: (serveHandler: typeof handler) => {
        handler = serveHandler;
      },
    });
    await import("./index.ts");
  });

  it("rejects a request without the secret and deletes nothing", async () => {
    const response = await handler(deleteRequest({}));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(removeFiles).not.toHaveBeenCalled();
  });

  it("rejects a request with a wrong secret and deletes nothing", async () => {
    const response = await handler(
      deleteRequest({ "x-note-attachments-secret": "not-the-secret" }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(removeFiles).not.toHaveBeenCalled();
  });

  it("deletes the unreferenced attachments when the secret is valid", async () => {
    const response = await handler(
      deleteRequest({ "x-note-attachments-secret": SECRET }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", deleted: 1 });
    expect(removeFiles).toHaveBeenCalledWith(["0.8262106278726917.pdf"]);
  });
});

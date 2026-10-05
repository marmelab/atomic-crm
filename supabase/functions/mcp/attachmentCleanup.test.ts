// @vitest-environment node
import { afterEach, describe, it, expect, vi } from "vitest";

const SUPABASE_URL = "http://supabase.test";

vi.hoisted(() => {
  const env: Record<string, string> = {
    SUPABASE_URL: "http://supabase.test",
    SB_PUBLISHABLE_KEY: "publishable-key",
  };
  vi.stubGlobal("Deno", { env: { get: (name: string) => env[name] } });
});

import {
  deleteAttachmentsAsUser,
  getRemovedAttachmentPaths,
} from "./attachmentCleanup";

const deletion = (attachments: unknown[]) => ({
  type: "DELETE",
  old_record: { attachments },
  record: { attachments: null },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getRemovedAttachmentPaths", () => {
  it("returns no path when no note attachment changed", () => {
    expect(getRemovedAttachmentPaths(null)).toEqual([]);
    expect(getRemovedAttachmentPaths("")).toEqual([]);
  });

  it("returns every file of a deleted note, resolving src urls to bucket paths", () => {
    const setting = JSON.stringify([
      deletion([
        { path: "a.txt" },
        { src: "http://host/storage/v1/object/attachments/b.txt" },
      ]),
    ]);

    expect(getRemovedAttachmentPaths(setting)).toEqual(["a.txt", "b.txt"]);
  });

  it("returns only the files removed from an updated note, once each", () => {
    const setting = JSON.stringify([
      {
        type: "UPDATE",
        old_record: {
          attachments: [{ path: "kept.txt" }, { path: "gone.txt" }],
        },
        record: { attachments: [{ path: "kept.txt" }] },
      },
      deletion([{ path: "gone.txt" }, { path: "other.txt" }]),
    ]);

    expect(getRemovedAttachmentPaths(setting)).toEqual([
      "gone.txt",
      "other.txt",
    ]);
  });

  it("ignores a malformed setting instead of throwing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(getRemovedAttachmentPaths("not json")).toEqual([]);
    expect(getRemovedAttachmentPaths('{"type":"DELETE"}')).toEqual([]);
    expect(
      getRemovedAttachmentPaths(
        JSON.stringify([
          null,
          deletion([{ path: 42 }]),
          deletion([{ path: "ok.txt" }]),
        ]),
      ),
    ).toEqual(["ok.txt"]);
  });
});

describe("deleteAttachmentsAsUser", () => {
  const storageReplies = (status: number, body: unknown) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
    );

  it("asks Storage to delete the files from the attachments bucket as the user", async () => {
    const fetchSpy = storageReplies(200, []);

    await deleteAttachmentsAsUser(["a.txt", "b.txt"], "user-token");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(`${SUPABASE_URL}/storage/v1/object/attachments`);
    expect(init?.method).toBe("DELETE");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer user-token",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      prefixes: ["a.txt", "b.txt"],
    });
  });

  it("logs and resolves when Storage refuses the deletion", async () => {
    storageReplies(500, { statusCode: "500", error: "boom", message: "boom" });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      deleteAttachmentsAsUser(["a.txt"], "user-token"),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to delete note attachments",
      expect.objectContaining({ paths: ["a.txt"] }),
    );
  });

  it("does not call Storage when no file was removed", async () => {
    const fetchSpy = storageReplies(200, []);

    await deleteAttachmentsAsUser([], "user-token");

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

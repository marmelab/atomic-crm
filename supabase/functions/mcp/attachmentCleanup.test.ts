// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal("Deno", { env: { get: () => undefined } });
});

import { getRemovedAttachmentPaths } from "./attachmentCleanup";

const deletion = (attachments: unknown[]) => ({
  type: "DELETE",
  old_record: { attachments },
  record: { attachments: null },
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

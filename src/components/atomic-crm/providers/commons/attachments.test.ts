import { describe, expect, it } from "vitest";

import { getSafeContentType } from "./attachments";

describe("getSafeContentType", () => {
  it("keeps the types the bucket allows", () => {
    expect(getSafeContentType("image/png")).toBe("image/png");
    expect(getSafeContentType("application/pdf")).toBe("application/pdf");
    expect(getSafeContentType("Text/Plain; charset=utf-8")).toBe("text/plain");
  });

  it("falls back to application/octet-stream for types a browser can run", () => {
    expect(getSafeContentType("image/svg+xml")).toBe(
      "application/octet-stream",
    );
    expect(getSafeContentType("text/html")).toBe("application/octet-stream");
    expect(getSafeContentType("application/xhtml+xml")).toBe(
      "application/octet-stream",
    );
    expect(getSafeContentType("application/javascript")).toBe(
      "application/octet-stream",
    );
  });

  it("falls back to application/octet-stream when the type is unknown", () => {
    expect(getSafeContentType("")).toBe("application/octet-stream");
    expect(getSafeContentType(undefined)).toBe("application/octet-stream");
    expect(
      getSafeContentType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("application/octet-stream");
  });
});

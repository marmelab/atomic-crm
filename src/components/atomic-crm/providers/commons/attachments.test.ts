import { describe, expect, it } from "vitest";

import { getSafeContentType, getStorageFileName } from "./attachments";

const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

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

describe("getStorageFileName", () => {
  it("names the file with a random UUID and its lowercased extension", () => {
    expect(getStorageFileName("Contract.PDF")).toMatch(
      new RegExp(`^${UUID}\\.pdf$`),
    );
  });

  it("returns a different name for each upload of the same file", () => {
    expect(getStorageFileName("a.pdf")).not.toBe(getStorageFileName("a.pdf"));
  });

  it("drops extensions that are not plain alphanumerics", () => {
    expect(getStorageFileName("notes")).toMatch(new RegExp(`^${UUID}$`));
    expect(getStorageFileName("a.my ext")).toMatch(new RegExp(`^${UUID}$`));
    expect(getStorageFileName("a.verylongextension")).toMatch(
      new RegExp(`^${UUID}$`),
    );
    expect(getStorageFileName(undefined)).toMatch(new RegExp(`^${UUID}$`));
  });
});

import { describe, it, expect } from "vitest";
import { mapResponse } from "./mapResponse";

describe("mapResponse", () => {
  it("maps a Valid response with stringified booleans", () => {
    const result = mapResponse(
      {
        Address: "x@y.com",
        Status: "Valid",
        catch_all: "false",
        Disposable_Domain: "false",
        Role_Based: "true",
        Free_Domain: "false",
        Greylisted: "false",
        Diagnosis: "Mailbox Exists and Active",
      },
      "2026-06-26T00:00:00.000Z",
    );

    expect(result.status).toBe("Valid");
    expect(result.roleBased).toBe(true);
    expect(result.disposable).toBe(false);
    expect(result.freeDomain).toBe(false);
    expect(result.diagnosis).toBe("Mailbox Exists and Active");
    expect(result.checkedAt).toBe("2026-06-26T00:00:00.000Z");
  });

  it("normalizes Invalid, Catch-all, and Unknown statuses", () => {
    expect(mapResponse({ Status: "Invalid" }).status).toBe("Invalid");
    expect(mapResponse({ Status: "Catch-all" }).status).toBe("Catch-all");
    expect(mapResponse({ Status: "catchall" }).status).toBe("Catch-all");
    expect(mapResponse({ Status: "catch all" }).status).toBe("Catch-all");
    expect(mapResponse({ Status: "anything else" }).status).toBe("Unknown");
    expect(mapResponse({}).status).toBe("Unknown");
  });

  it("falls back to Catch-all when only the catch_all flag is set", () => {
    expect(mapResponse({ Status: "", catch_all: "true" }).status).toBe(
      "Catch-all",
    );
  });

  it("coerces stringified booleans for all flags", () => {
    const r = mapResponse({
      Status: "Valid",
      Role_Based: "false",
      Disposable_Domain: "true",
      Free_Domain: "true",
    });
    expect(r.roleBased).toBe(false);
    expect(r.disposable).toBe(true);
    expect(r.freeDomain).toBe(true);
  });

  it("leaves diagnosis undefined when absent or empty", () => {
    expect(mapResponse({ Status: "Valid" }).diagnosis).toBeUndefined();
    expect(mapResponse({ Status: "Valid", Diagnosis: "" }).diagnosis).toBe(
      undefined,
    );
  });
});

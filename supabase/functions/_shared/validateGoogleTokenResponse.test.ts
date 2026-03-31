import { describe, expect, it } from "vitest";
import { validateGoogleTokenResponse } from "./validateGoogleTokenResponse.ts";

describe("validateGoogleTokenResponse", () => {
  it("returns validated fields from a valid response", () => {
    const result = validateGoogleTokenResponse({
      access_token: "ya29.abc123",
      expires_in: 3600,
      token_type: "Bearer",
    });
    expect(result).toEqual({
      access_token: "ya29.abc123",
      expires_in: 3600,
    });
  });

  it("throws when access_token is missing", () => {
    expect(() => validateGoogleTokenResponse({ expires_in: 3600 })).toThrow(
      "Invalid Google token response",
    );
  });

  it("throws when access_token is empty string", () => {
    expect(() =>
      validateGoogleTokenResponse({ access_token: "", expires_in: 3600 }),
    ).toThrow("Invalid Google token response");
  });

  it("throws when expires_in is missing", () => {
    expect(() =>
      validateGoogleTokenResponse({ access_token: "ya29.abc" }),
    ).toThrow("Invalid Google token response");
  });

  it("throws when expires_in is zero", () => {
    expect(() =>
      validateGoogleTokenResponse({
        access_token: "ya29.abc",
        expires_in: 0,
      }),
    ).toThrow("Invalid Google token response");
  });

  it("throws when expires_in is negative", () => {
    expect(() =>
      validateGoogleTokenResponse({
        access_token: "ya29.abc",
        expires_in: -1,
      }),
    ).toThrow("Invalid Google token response");
  });

  it("throws when body is not an object", () => {
    expect(() => validateGoogleTokenResponse("not an object")).toThrow(
      "Invalid Google token response",
    );
  });

  it("throws when body is null", () => {
    expect(() => validateGoogleTokenResponse(null)).toThrow(
      "Invalid Google token response",
    );
  });
});

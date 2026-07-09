import { describe, expect, test } from "vitest";
import { parseEnabledOAuthProviders } from "./ConfigurationContext";

describe("parseEnabledOAuthProviders", () => {
  test("returns empty array when value is undefined", () => {
    expect(parseEnabledOAuthProviders(undefined)).toEqual([]);
  });

  test("returns empty array when value is an empty string", () => {
    expect(parseEnabledOAuthProviders("")).toEqual([]);
  });

  test("parses a single provider", () => {
    expect(parseEnabledOAuthProviders("google")).toEqual(["google"]);
  });

  test("parses a comma-separated list of providers", () => {
    expect(parseEnabledOAuthProviders("google,facebook")).toEqual([
      "google",
      "facebook",
    ]);
  });

  test("trims whitespace and lowercases entries", () => {
    expect(parseEnabledOAuthProviders(" Google , FACEBOOK ")).toEqual([
      "google",
      "facebook",
    ]);
  });

  test("discards unknown providers", () => {
    expect(parseEnabledOAuthProviders("google,myspace,facebook")).toEqual([
      "google",
      "facebook",
    ]);
  });

  test("returns empty array when no entries are valid", () => {
    expect(parseEnabledOAuthProviders("myspace,friendster")).toEqual([]);
  });
});

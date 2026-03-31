import { describe, it, expect } from "vitest";
import {
  parseAiVisualBlocks,
  InvalidAiOutputError,
} from "./parseAiVisualBlocks.ts";

describe("parseAiVisualBlocks", () => {
  it("parses a valid JSON array", () => {
    const input = JSON.stringify([{ type: "heading", text: "Hello" }]);
    expect(parseAiVisualBlocks(input)).toEqual([
      { type: "heading", text: "Hello" },
    ]);
  });

  it("parses a valid JSON object", () => {
    const input = JSON.stringify({ type: "heading", text: "Hello" });
    expect(parseAiVisualBlocks(input)).toEqual({
      type: "heading",
      text: "Hello",
    });
  });

  it("throws InvalidAiOutputError on malformed JSON", () => {
    expect(() => parseAiVisualBlocks("{not valid json")).toThrow(
      InvalidAiOutputError,
    );
  });

  it("throws InvalidAiOutputError on empty string", () => {
    expect(() => parseAiVisualBlocks("")).toThrow(InvalidAiOutputError);
  });

  it("throws with a user-facing message", () => {
    expect(() => parseAiVisualBlocks("Ecco il riepilogo dell'anno")).toThrow(
      "L'AI ha generato una risposta non valida. Riprova.",
    );
  });
});

/**
 * Distinguishable error class for AI visual-mode parse failures.
 * Allows EF catch blocks to return 502 with a specific message
 * instead of the generic 500 "impossibile generare...".
 */
export class InvalidAiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAiOutputError";
  }
}

/**
 * Parse AI visual-mode output as JSON blocks.
 * Returns `any` to match `JSON.parse` signature and avoid
 * type-level changes at call sites.
 *
 * @throws {InvalidAiOutputError} on malformed output
 */
// deno-lint-ignore no-explicit-any
export function parseAiVisualBlocks(outputText: string): any {
  try {
    return JSON.parse(outputText);
  } catch {
    console.error("parseAiVisualBlocks.invalid_json", outputText.slice(0, 500));
    throw new InvalidAiOutputError(
      "L'AI ha generato una risposta non valida. Riprova.",
    );
  }
}

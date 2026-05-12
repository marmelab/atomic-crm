import { LLMock } from "@copilotkit/aimock";
import path from "node:path";

const FIXTURES_DIR = path.join(__dirname, "fixtures");

/**
 * Create and start an LLMock server with all CRM workflow fixtures loaded.
 *
 * Fixture load order matters (first match wins):
 * 1. Specific workflow fixtures (review-account, analyze-contract, etc.)
 * 2. Catch-all for tool results
 *
 * Usage:
 *   const mock = await createCRMMock();
 *   process.env.OPENAI_BASE_URL = mock.url;
 *   // ... run tests ...
 *   await mock.stop();
 */
export async function createCRMMock(options?: {
  port?: number;
  latency?: number;
}) {
  const mock = new LLMock({
    port: options?.port ?? 0,
    latency: options?.latency ?? 0,
    chunkSize: 50,
  });

  // Load specific workflow fixtures first (higher priority)
  mock.loadFixtureFile(path.join(FIXTURES_DIR, "review-account.json"));
  mock.loadFixtureFile(path.join(FIXTURES_DIR, "analyze-contract.json"));
  mock.loadFixtureFile(path.join(FIXTURES_DIR, "forecast-review.json"));
  mock.loadFixtureFile(path.join(FIXTURES_DIR, "lead-triage.json"));

  // Catch-all for tool result follow-ups (must be last)
  mock.loadFixtureFile(path.join(FIXTURES_DIR, "tool-results-catchall.json"));

  const url = await mock.start();
  console.log(`[llmock] Running at ${url}`);

  return mock;
}

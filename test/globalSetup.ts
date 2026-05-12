import type { GlobalSetupContext } from "vitest/node";
import { LLMock } from "@copilotkit/aimock";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");

export default async function setup({ provide }: GlobalSetupContext) {
  const mock = new LLMock({
    port: 0,
    latency: 0,
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
  console.log(`[aimock globalSetup] Running at ${url}`);

  // Provide the URL and serialized fixtures to browser tests.
  // Fixtures are static (loaded from JSON), so serializing them once is safe.
  provide("aimockUrl", mock.baseUrl);
  provide(
    "aimockFixtures",
    JSON.parse(JSON.stringify(mock.getFixtures())) as SerializedFixture[],
  );

  // Capture `mock` in the closure so each globalSetup invocation tears down
  // its own server instance (Vitest may call globalSetup once per project).
  return async () => {
    await mock.stop();
    console.log("[aimock globalSetup] Stopped");
  };
}

// Minimal shape that the browser tests need — avoids importing aimock types
// in the browser context.
interface SerializedFixture {
  match: Record<string, unknown>;
  response: Record<string, unknown>;
}

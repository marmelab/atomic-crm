import { describe, it, expect, inject } from "vitest";

/**
 * These tests run in browser mode (Chromium). The aimock server runs in Node
 * context via test/globalSetup.ts. We receive the server URL and a snapshot of
 * the loaded fixtures through Vitest's provide/inject mechanism — this avoids
 * importing @copilotkit/aimock in the browser, which would fail because aimock
 * extends Node-only classes (http.Server, etc.).
 */
const aimockUrl = inject("aimockUrl");
const fixtures = inject("aimockFixtures");

describe("CopilotKit workflow fixtures", () => {
  it("loads all fixtures without errors", () => {
    // 4 workflow fixtures + 1 catch-all
    expect(fixtures.length).toBe(5);
  });

  it("matches review account prompt", () => {
    const match = fixtures.find(
      (f) =>
        typeof f.match.userMessage === "string" &&
        (f.match.userMessage as string).includes("Review the account"),
    );
    expect(match).toBeDefined();
    expect("toolCalls" in match!.response).toBe(true);
    const response = match!.response as { toolCalls: Array<{ name: string }> };
    const toolNames = response.toolCalls.map((tc) => tc.name);
    expect(toolNames).toContain("getContactsByCompany");
    expect(toolNames).toContain("AccountSummary");
    expect(toolNames).toContain("MissingSignals");
    expect(toolNames).toContain("RiskIndicators");
    expect(toolNames).toContain("NextActions");
  });

  it("matches analyze contract prompt", () => {
    const match = fixtures.find(
      (f) =>
        typeof f.match.userMessage === "string" &&
        (f.match.userMessage as string).includes("Analyze the contract"),
    );
    expect(match).toBeDefined();
    const response = match!.response as { toolCalls: Array<{ name: string }> };
    expect(response.toolCalls[0].name).toBe("analyzeContract");
  });

  it("matches forecast review prompt", () => {
    const match = fixtures.find(
      (f) =>
        typeof f.match.userMessage === "string" &&
        (f.match.userMessage as string).includes("Review the renewal forecast"),
    );
    expect(match).toBeDefined();
    const response = match!.response as { toolCalls: Array<{ name: string }> };
    expect(response.toolCalls[0].name).toBe("updateRenewalForecast");
  });

  it("matches lead triage prompt", () => {
    const match = fixtures.find(
      (f) =>
        typeof f.match.userMessage === "string" &&
        (f.match.userMessage as string).includes("Triage the top leads"),
    );
    expect(match).toBeDefined();
    const response = match!.response as { toolCalls: Array<{ name: string }> };
    const toolNames = response.toolCalls.map((tc) => tc.name);
    expect(toolNames).toContain("getTopLeads");
    expect(toolNames).toContain("LeadPriorityList");
  });

  it("has a catch-all fixture for tool results", () => {
    const catchAll = fixtures[fixtures.length - 1];
    expect(catchAll.match).toEqual({});
    expect("content" in catchAll.response).toBe(true);
  });

  it("streams review account response via HTTP", async () => {
    const res = await fetch(`${aimockUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-key",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        stream: true,
        messages: [
          { role: "system", content: "You are a Revenue Operations Copilot." },
          {
            role: "user",
            content:
              "Review the account for Fannie Pfeffer at Gottlieb and Sons.",
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    // SSE stream should contain our tool call names
    expect(text).toContain("getContactsByCompany");
    expect(text).toContain("AccountSummary");
    expect(text).toContain("MissingSignals");

    // Verify journal recorded the request via the control API
    const journalRes = await fetch(`${aimockUrl}/__aimock/journal`);
    const journal = (await journalRes.json()) as Array<{
      response: { fixture: unknown };
    }>;
    expect(journal.length).toBeGreaterThan(0);
    const lastEntry = journal[journal.length - 1];
    expect(lastEntry.response.fixture).toBeDefined();
  });

  it("review account fixture has deterministic data", () => {
    const match = fixtures.find(
      (f) =>
        typeof f.match.userMessage === "string" &&
        (f.match.userMessage as string).includes("Review the account"),
    );
    const response = match!.response as {
      toolCalls: Array<{ name: string; arguments: string }>;
    };
    const summary = response.toolCalls.find(
      (tc) => tc.name === "AccountSummary",
    );
    const args = JSON.parse(summary!.arguments);
    expect(args.company).toBe("Gottlieb and Sons");
    expect(args.contactCount).toBe(12);
    expect(args.hotCount).toBe(1);
  });
});

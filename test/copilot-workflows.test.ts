import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createCRMMock } from "./llmock-setup";
import type { LLMock } from "@copilotkit/aimock";

describe("CopilotKit workflow fixtures", () => {
  let mock: LLMock;

  beforeAll(async () => {
    mock = await createCRMMock();
  });

  afterAll(async () => {
    await mock.stop();
  });

  it("loads all fixtures without errors", () => {
    const fixtures = mock.getFixtures();
    // 4 workflow fixtures + 1 catch-all
    expect(fixtures.length).toBe(5);
  });

  it("matches review account prompt", () => {
    const fixtures = mock.getFixtures();
    const match = fixtures.find(
      (f) =>
        typeof f.match.userMessage === "string" &&
        f.match.userMessage.includes("Review the account"),
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
    const fixtures = mock.getFixtures();
    const match = fixtures.find(
      (f) =>
        typeof f.match.userMessage === "string" &&
        f.match.userMessage.includes("Analyze the contract"),
    );
    expect(match).toBeDefined();
    const response = match!.response as { toolCalls: Array<{ name: string }> };
    expect(response.toolCalls[0].name).toBe("analyzeContract");
  });

  it("matches forecast review prompt", () => {
    const fixtures = mock.getFixtures();
    const match = fixtures.find(
      (f) =>
        typeof f.match.userMessage === "string" &&
        f.match.userMessage.includes("Review the renewal forecast"),
    );
    expect(match).toBeDefined();
    const response = match!.response as { toolCalls: Array<{ name: string }> };
    expect(response.toolCalls[0].name).toBe("updateRenewalForecast");
  });

  it("matches lead triage prompt", () => {
    const fixtures = mock.getFixtures();
    const match = fixtures.find(
      (f) =>
        typeof f.match.userMessage === "string" &&
        f.match.userMessage.includes("Triage the top leads"),
    );
    expect(match).toBeDefined();
    const response = match!.response as { toolCalls: Array<{ name: string }> };
    const toolNames = response.toolCalls.map((tc) => tc.name);
    expect(toolNames).toContain("getTopLeads");
    expect(toolNames).toContain("LeadPriorityList");
  });

  it("has a catch-all fixture for tool results", () => {
    const fixtures = mock.getFixtures();
    const catchAll = fixtures[fixtures.length - 1];
    expect(catchAll.match).toEqual({});
    expect("content" in catchAll.response).toBe(true);
  });

  it("streams review account response via HTTP", async () => {
    const res = await fetch(`${mock.baseUrl}/v1/chat/completions`, {
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

    // Verify journal recorded the request
    const lastReq = mock.getLastRequest();
    expect(lastReq).toBeDefined();
    expect(lastReq!.response.fixture).toBeDefined();
  });

  it("review account fixture has deterministic data", () => {
    const fixtures = mock.getFixtures();
    const match = fixtures.find(
      (f) =>
        typeof f.match.userMessage === "string" &&
        f.match.userMessage.includes("Review the account"),
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

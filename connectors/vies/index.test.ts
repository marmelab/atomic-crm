// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ConnectorContext } from "../types.ts";
import { checkVat, normalizeVatNumber, splitAddress } from "./index.ts";

const answer = (body: unknown, status = 200): ConnectorContext => ({
  fetch: async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
});

const requestedUrls: string[] = [];
const recording = (body: unknown): ConnectorContext => ({
  fetch: async (url) => {
    requestedUrls.push(String(url));
    return new Response(JSON.stringify(body));
  },
});

describe("VIES connector", () => {
  it("fills the name and address of a valid Polish VAT number", async () => {
    const result = await checkVat(
      { countryCode: "PL", vatNumber: "774-000-14-54" },
      answer({
        isValid: true,
        userError: "VALID",
        name: "ORLEN SPÓŁKA AKCYJNA",
        address: "CHEMIKÓW 7\n09-411 PŁOCK",
      }),
    );

    expect(result).toEqual({
      status: "valid",
      vatId: "PL7740001454",
      name: "ORLEN SPÓŁKA AKCYJNA",
      address: "CHEMIKÓW 7",
      zipcode: "09-411",
      city: "PŁOCK",
    });
  });

  it("reports an unknown number as invalid", async () => {
    const result = await checkVat(
      { countryCode: "DE", vatNumber: "DE123456789" },
      answer({ isValid: false, userError: "INVALID", name: "", address: "" }),
    );
    expect(result).toEqual({ status: "invalid", vatId: "DE123456789" });
  });

  it("tells 'could not check' apart from 'invalid' when a member state is down", async () => {
    const result = await checkVat(
      { countryCode: "DE", vatNumber: "123456789" },
      answer({ isValid: false, userError: "MS_UNAVAILABLE" }),
    );
    expect(result.status).toBe("unavailable");
  });

  it("is unavailable, not invalid, when VIES does not answer", async () => {
    const failing: ConnectorContext = {
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    };
    const result = await checkVat(
      { countryCode: "FR", vatNumber: "40303265045" },
      failing,
    );
    expect(result.status).toBe("unavailable");
    expect(
      (
        await checkVat(
          { countryCode: "FR", vatNumber: "40303265045" },
          answer({}, 503),
        )
      ).status,
    ).toBe("unavailable");
  });

  it("does not call VIES for a country outside the EU", async () => {
    requestedUrls.length = 0;
    const result = await checkVat(
      { countryCode: "UA", vatNumber: "14360570" },
      recording({}),
    );
    expect(result.status).toBe("unavailable");
    expect(requestedUrls).toEqual([]);
  });

  it("asks VIES for Greece under its own prefix EL", async () => {
    requestedUrls.length = 0;
    await checkVat(
      { countryCode: "GR", vatNumber: "EL094014201" },
      recording({ isValid: false, userError: "INVALID" }),
    );
    expect(requestedUrls[0]).toMatch(/\/ms\/EL\/vat\/094014201$/);
  });

  it("keeps a hidden name empty instead of writing '---'", async () => {
    const result = await checkVat(
      { countryCode: "DE", vatNumber: "123456789" },
      answer({ isValid: true, name: "---", address: "---" }),
    );
    expect(result).toEqual({
      status: "valid",
      vatId: "DE123456789",
      name: undefined,
    });
  });
});

describe("VAT number helpers", () => {
  it("drops the country prefix, spaces and dashes", () => {
    expect(normalizeVatNumber("PL", "pl 774-000-14-54")).toBe("7740001454");
    expect(normalizeVatNumber("DE", "123 456 789")).toBe("123456789");
  });

  it("keeps an unrecognized address on the street line", () => {
    expect(splitAddress("1 RUE DE LA PAIX PARIS")).toEqual({
      address: "1 RUE DE LA PAIX PARIS",
    });
  });
});

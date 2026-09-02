// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAcuityAppointment } from "./acuityApi";

const CREDENTIALS = { userId: "42", apiKey: "secret-key" };

describe("fetchAcuityAppointment", () => {
  const originalFetch = global.fetch;
  const originalError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    console.error = originalError;
  });

  it("normalizes a successful appointment response and sends Basic Auth from the given credentials", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          email: "ada@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
          datetime: "2026-09-10T18:00:00.000Z",
          appointmentTypeID: 111,
        }),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await fetchAcuityAppointment("12345", CREDENTIALS);

    expect(result).toEqual({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      datetime: "2026-09-10T18:00:00.000Z",
      appointmentTypeID: 111,
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://acuityscheduling.com/api/v1/appointments/12345");
    expect(init.headers.Authorization).toBe(`Basic ${btoa("42:secret-key")}`);
  });

  it("returns null (never fabricates data) when Acuity responds with a non-ok status", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;

    const result = await fetchAcuityAppointment("missing", CREDENTIALS);

    expect(result).toBeNull();
  });

  it("returns null (never throws) on a network error", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await fetchAcuityAppointment("12345", CREDENTIALS);

    expect(result).toBeNull();
  });

  it("never logs the API key or the Authorization header on failure", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const errorSpy = console.error as ReturnType<typeof vi.fn>;

    await fetchAcuityAppointment("12345", CREDENTIALS);

    const loggedText = errorSpy.mock.calls.flat().join(" ");
    expect(loggedText).not.toContain(CREDENTIALS.apiKey);
    expect(loggedText).not.toContain(btoa("42:secret-key"));
  });
});

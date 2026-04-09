import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  daysUntilRenewal,
  isExpiringSoon,
  getStatusLabel,
} from "./contractUtils";

describe("contractUtils", () => {
  const FIXED_DATE = new Date("2026-04-09T12:00:00Z");

  beforeEach(() => {
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("daysUntilRenewal", () => {
    it("returns 30 for a date 30 days in the future", () => {
      expect(daysUntilRenewal("2026-05-09")).toBe(30);
    });

    it("returns 0 for today", () => {
      expect(daysUntilRenewal("2026-04-09")).toBe(0);
    });

    it("returns -10 for a date 10 days in the past", () => {
      expect(daysUntilRenewal("2026-03-30")).toBe(-10);
    });
  });

  describe("isExpiringSoon", () => {
    it("returns true when renewal is within 60 days", () => {
      expect(isExpiringSoon("2026-05-09")).toBe(true); // 30 days away
    });

    it("returns false when renewal is beyond 60 days", () => {
      expect(isExpiringSoon("2026-07-15")).toBe(false); // 97 days away
    });

    it("returns true for past date", () => {
      expect(isExpiringSoon("2026-03-30")).toBe(true); // -10 days
    });
  });

  describe("getStatusLabel", () => {
    it("returns 'Actif' for 'actif'", () => {
      expect(getStatusLabel("actif")).toBe("Actif");
    });

    it("returns 'À renouveler' for 'a-renouveler'", () => {
      expect(getStatusLabel("a-renouveler")).toBe("À renouveler");
    });

    it("returns 'Résilié' for 'resilier'", () => {
      expect(getStatusLabel("resilier")).toBe("Résilié");
    });
  });
});

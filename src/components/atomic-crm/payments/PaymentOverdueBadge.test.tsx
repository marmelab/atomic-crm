// @vitest-environment jsdom

import "@/setupTests";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useGetList = vi.fn();

vi.mock("ra-core", async () => {
  const actual = await vi.importActual<typeof import("ra-core")>("ra-core");
  return {
    ...actual,
    useGetList: (...args: unknown[]) => useGetList(...args),
  };
});

import { PaymentOverdueBadge } from "./PaymentOverdueBadge";

describe("PaymentOverdueBadge", () => {
  beforeEach(() => {
    useGetList.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queries overdue payments using the Europe/Rome business date", () => {
    vi.setSystemTime(new Date("2026-03-09T23:30:00.000Z"));
    useGetList.mockReturnValue({
      total: 0,
      isPending: false,
    });

    render(<PaymentOverdueBadge />);

    expect(useGetList).toHaveBeenCalledWith(
      "payments",
      expect.objectContaining({
        filter: expect.objectContaining({
          "status@neq": "ricevuto",
          "payment_date@lt": "2026-03-10",
        }),
      }),
    );
  });

  it("renders the overdue count when at least one payment is late", () => {
    vi.setSystemTime(new Date("2026-03-05T12:00:00.000Z"));
    useGetList.mockReturnValue({
      total: 2,
      isPending: false,
    });

    render(<PaymentOverdueBadge />);

    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

// @vitest-environment jsdom

import "@/setupTests";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useGetList = vi.fn();

vi.mock("ra-core", async () => {
  const actual = await vi.importActual("ra-core");
  return {
    ...actual,
    useGetList: (...args: unknown[]) => useGetList(...args),
  };
});

import { QuotePaymentsSection } from "./QuotePaymentsSection";

const renderSection = () =>
  render(
    <MemoryRouter>
      <QuotePaymentsSection quote={{ id: 12, amount: 1000 }} />
    </MemoryRouter>,
  );

describe("QuotePaymentsSection", () => {
  beforeEach(() => {
    useGetList.mockReset();
  });

  it("renders the linked payment summary and list", async () => {
    useGetList.mockReturnValue({
      data: [
        {
          id: 1,
          client_id: 3,
          quote_id: 12,
          payment_type: "acconto",
          amount: 200,
          status: "ricevuto",
          payment_date: "2026-02-20",
          created_at: "2026-02-20",
        },
        {
          id: 2,
          client_id: 3,
          quote_id: 12,
          payment_type: "saldo",
          amount: 300,
          status: "in_attesa",
          payment_date: "2026-03-10",
          created_at: "2026-02-21",
        },
      ],
      isPending: false,
      error: null,
    });

    renderSection();

    expect(screen.getByText("Pagamenti collegati")).toBeInTheDocument();
    expect(screen.getByText("Da ricevere gia registrato")).toBeInTheDocument();
    expect(screen.getByText("Ancora da collegare")).toBeInTheDocument();
    expect(screen.getByText("1 pagamento ricevuto")).toBeInTheDocument();
    expect(screen.getByText("1 pagamento in attesa")).toBeInTheDocument();
    expect(screen.getByText("Acconto")).toBeInTheDocument();
    expect(screen.getByText("Saldo")).toBeInTheDocument();
  });

  it("renders the empty state when no linked payments exist", () => {
    useGetList.mockReturnValue({
      data: [],
      isPending: false,
      error: null,
    });

    renderSection();

    expect(
      screen.getByText(
        "Nessun pagamento collegato ancora a questo preventivo.",
      ),
    ).toBeInTheDocument();
  });

  it("renders a non-blocking error state", () => {
    useGetList.mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error("boom"),
    });

    renderSection();

    expect(
      screen.getByText("Impossibile leggere i pagamenti collegati adesso."),
    ).toBeInTheDocument();
  });
});

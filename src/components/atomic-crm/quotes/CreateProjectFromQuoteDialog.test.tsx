// @vitest-environment jsdom

import "@/setupTests";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Client, Quote } from "../types";

const create = vi.fn();
const update = vi.fn();
const notify = vi.fn();
const refresh = vi.fn();

vi.mock("ra-core", async () => {
  const actual = await vi.importActual("ra-core");
  return {
    ...actual,
    useCreate: () => [create],
    useUpdate: () => [update],
    useNotify: () => notify,
    useRefresh: () => refresh,
  };
});

import { CreateProjectFromQuoteDialog } from "./CreateProjectFromQuoteDialog";

const client: Client = {
  id: "client-1",
  name: "Cliente Test",
  client_type: "azienda_locale",
  created_at: "2026-02-28T08:00:00.000Z",
  updated_at: "2026-02-28T08:00:00.000Z",
  tags: [],
};

const quote: Quote = {
  id: "quote-1",
  client_id: client.id,
  project_id: null,
  service_type: "produzione_tv",
  event_start: "2026-03-15T00:00:00.000Z",
  event_end: "2026-03-16T00:00:00.000Z",
  all_day: true,
  description: "Preventivo Test",
  amount: 1800,
  status: "accettato",
  sent_date: "2026-02-20",
  response_date: "2026-02-22",
  notes: null,
  index: 1,
  created_at: "2026-02-28T08:00:00.000Z",
  updated_at: "2026-02-28T08:00:00.000Z",
};

describe("CreateProjectFromQuoteDialog", () => {
  beforeEach(() => {
    create.mockReset();
    update.mockReset();
    notify.mockReset();
    refresh.mockReset();
  });

  it("links the quote when useCreate resolves to a direct record", async () => {
    create.mockResolvedValue({
      id: "project-123",
      name: "Preventivo Test - Cliente Test",
    });
    update.mockResolvedValue({});

    render(<CreateProjectFromQuoteDialog client={client} quote={quote} />);

    fireEvent.click(screen.getByRole("button", { name: "Crea progetto" }));
    await screen.findByText("Crea progetto dal preventivo");

    fireEvent.click(screen.getByRole("button", { name: "Crea e collega" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "quotes",
        {
          id: quote.id,
          data: { project_id: "project-123" },
          previousData: quote,
        },
        { returnPromise: true },
      ),
    );

    expect(notify).toHaveBeenCalledWith(
      "Progetto creato e collegato al preventivo.",
      {
        type: "success",
      },
    );
    expect(refresh).toHaveBeenCalled();
  });
});

// @vitest-environment jsdom

import "@/setupTests";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getQuoteStatusEmailContext = vi.fn();
const sendQuoteStatusEmail = vi.fn();
const notify = vi.fn();

vi.mock("ra-core", async () => {
  const actual = await vi.importActual<typeof import("ra-core")>("ra-core");
  return {
    ...actual,
    useDataProvider: () => ({
      getQuoteStatusEmailContext,
      sendQuoteStatusEmail,
    }),
    useNotify: () => notify,
  };
});

import { SendQuoteStatusEmailDialog } from "./SendQuoteStatusEmailDialog";

const renderDialog = (status: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SendQuoteStatusEmailDialog quote={{ id: "quote-1", status }} />
    </QueryClientProvider>,
  );
};

describe("SendQuoteStatusEmailDialog", () => {
  beforeEach(() => {
    getQuoteStatusEmailContext.mockReset();
    sendQuoteStatusEmail.mockReset();
    notify.mockReset();
  });

  it("loads the shared draft, renders the preview, and sends through the provider", async () => {
    getQuoteStatusEmailContext.mockResolvedValue({
      quoteId: "quote-1",
      clientId: "client-1",
      projectId: "project-1",
      businessName: "Gestionale Rosario Furnari",
      quote: {
        status: "accettato",
        description: "Wedding completo",
        amount: 1800,
        all_day: true,
      },
      client: {
        name: "Maria Rossi",
        email: "maria@example.com",
      },
      projectName: "Wedding Maria e Luca",
      serviceLabel: "Wedding",
      paymentAmount: null,
      amountPaid: null,
      amountDue: 1800,
      hasNonTaxableServices: false,
      latestReceivedPaymentAmount: null,
    });
    sendQuoteStatusEmail.mockResolvedValue({
      messageId: "message-1",
      accepted: ["maria@example.com"],
      rejected: [],
      response: "250 OK",
    });

    renderDialog("accettato");

    fireEvent.click(screen.getByRole("button", { name: "Invia mail cliente" }));

    await waitFor(() =>
      expect(getQuoteStatusEmailContext).toHaveBeenCalledWith("quote-1"),
    );

    expect(await screen.findByDisplayValue("maria@example.com")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Template consigliato per questo stato, ma l'invio resta sempre manuale.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Messaggio opzionale"), {
      target: {
        value: "Ti aggiorno appena chiudo anche il calendario operativo.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invia con Gmail" }));

    await waitFor(() =>
      expect(sendQuoteStatusEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "maria@example.com",
          status: "accettato",
          templateId: "quote-status.accettato",
          automatic: false,
        }),
      ),
    );
  });

  it("keeps the send action disabled when required fields are missing", async () => {
    getQuoteStatusEmailContext.mockResolvedValue({
      quoteId: "quote-1",
      clientId: "client-1",
      projectId: null,
      businessName: "Gestionale Rosario Furnari",
      quote: {
        status: "in_trattativa",
        description: "Preventivo senza mail",
        amount: 1200,
        all_day: true,
      },
      client: {
        name: "Cliente senza email",
        email: "",
      },
      projectName: null,
      serviceLabel: "Wedding",
      paymentAmount: null,
      amountPaid: null,
      amountDue: 1200,
      hasNonTaxableServices: false,
      latestReceivedPaymentAmount: null,
    });

    renderDialog("in_trattativa");

    fireEvent.click(screen.getByRole("button", { name: "Invia mail cliente" }));

    expect(
      await screen.findByText("Manca ancora: email cliente."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Invia con Gmail" }),
    ).toBeDisabled();
  });
});

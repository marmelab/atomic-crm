// @vitest-environment jsdom

import "@/setupTests";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { unifiedCrmQuestionMaxLength } from "@/lib/ai/unifiedCrmAssistant";

const useIsMobile = vi.fn();
const getUnifiedCrmReadContext = vi.fn();
const askUnifiedCrmQuestion = vi.fn();
const getInvoiceImportWorkspace = vi.fn();
const uploadInvoiceImportFiles = vi.fn();
const generateInvoiceImportDraft = vi.fn();
const confirmInvoiceImportDraft = vi.fn();
const notify = vi.fn();

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobile(),
}));

vi.mock("ra-core", async () => {
  const actual = await vi.importActual<typeof import("ra-core")>("ra-core");
  return {
    ...actual,
    useDataProvider: () => ({
      getUnifiedCrmReadContext,
      askUnifiedCrmQuestion,
      getInvoiceImportWorkspace,
      uploadInvoiceImportFiles,
      generateInvoiceImportDraft,
      confirmInvoiceImportDraft,
    }),
    useNotify: () => notify,
  };
});

vi.mock("../root/ConfigurationContext", () => ({
  useConfigurationContext: () => ({
    aiConfig: {
      historicalAnalysisModel: "gpt-5.2",
      invoiceExtractionModel: "gemini-2.5-pro",
    },
  }),
}));

import { UnifiedAiLauncher } from "./UnifiedAiLauncher";

const renderLauncher = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UnifiedAiLauncher />
    </QueryClientProvider>,
  );
};

describe("UnifiedAiLauncher", () => {
  beforeEach(() => {
    useIsMobile.mockReset();
    useIsMobile.mockReturnValue(false);
    getUnifiedCrmReadContext.mockReset();
    askUnifiedCrmQuestion.mockReset();
    getInvoiceImportWorkspace.mockReset();
    uploadInvoiceImportFiles.mockReset();
    generateInvoiceImportDraft.mockReset();
    confirmInvoiceImportDraft.mockReset();
    notify.mockReset();

    getUnifiedCrmReadContext.mockResolvedValue({
      meta: {
        generatedAt: "2026-02-28T22:00:00.000Z",
        generatedAtLabel: "28/02/26, 23:00",
        businessTimezone: "Europe/Rome",
        routePrefix: "/#/",
        scope: "crm_read_snapshot",
      },
      registries: {
        semantic: {
          dictionaries: {
            clientTypes: [],
            acquisitionSources: [],
            projectCategories: [],
            projectStatuses: [],
            projectTvShows: [],
            quoteStatuses: [],
            quoteServiceTypes: [],
            serviceTypes: [],
            paymentTypes: [],
            paymentMethods: [],
            paymentStatuses: [],
          },
          fields: {
            descriptions: [],
            dates: [],
          },
          rules: {
            serviceNetValue: {
              formula: "",
              taxableFlagField: "is_taxable",
              meaning: "",
            },
            travelReimbursement: {
              formula: "",
              defaultKmRate: 0.19,
              meaning: "",
            },
            dateRanges: {
              allDayField: "all_day",
              meaning: "",
            },
            quoteStatusEmail: {
              outstandingDueFormula: "",
              automaticBlockerField: "services.is_taxable",
              meaning: "",
            },
            invoiceImport: {
              customerInvoiceResource: "payments",
              supplierInvoiceResource: "expenses",
              confirmationRule: "",
              meaning: "",
            },
            unifiedAiReadContext: {
              scope:
                "clients + contacts + project_contacts + quotes + projects + payments + expenses",
              freshnessField: "generatedAt",
              meaning: "",
            },
          },
        },
        capability: {
          routing: {
            mode: "hash",
            routePrefix: "/#/",
            meaning: "",
          },
          resources: [],
          pages: [],
          dialogs: [],
          actions: [],
          communications: {
            quoteStatusEmails: {
              provider: "gmail_smtp",
              description: "",
              sharedBlocks: [],
              safetyRules: [],
              requiredEnvKeys: [],
              templates: [],
            },
            internalPriorityNotifications: {
              provider: "callmebot",
              description: "",
              useCases: [],
              requiredEnvKeys: [],
              rules: [],
            },
          },
          integrationChecklist: [],
        },
      },
      snapshot: {
        counts: {
          clients: 1,
          contacts: 1,
          quotes: 1,
          openQuotes: 1,
          activeProjects: 1,
          pendingPayments: 1,
          expenses: 1,
        },
        totals: {
          openQuotesAmount: 1200,
          pendingPaymentsAmount: 800,
          expensesAmount: 300,
        },
        recentClients: [
          {
            clientId: "client-1",
            clientName: "MARIO ROSSI STUDIO",
            operationalName: "Mario Rossi",
            billingName: "MARIO ROSSI STUDIO",
            email: "mario@example.com",
            vatNumber: "IT12345678901",
            fiscalCode: "RSSMRA80A01C351Z",
            billingAddress: "Via Etnea, 10 · 95100 Catania CT · IT",
            billingCity: "Catania",
            billingSdiCode: "M5UXCR1",
            billingPec: "mario@examplepec.it",
            contacts: [
              {
                contactId: "101",
                displayName: "Diego Caltabiano",
                title: "Referente operativo",
                email: "diego@gustare.it",
                phone: "+39 333 1234567",
              },
            ],
            activeProjects: [
              {
                projectId: "project-1",
                projectName: "Wedding Mario",
                status: "in_corso",
                statusLabel: "In corso",
              },
            ],
            createdAt: "2026-02-20T10:00:00.000Z",
          },
        ],
        recentContacts: [
          {
            contactId: "101",
            displayName: "Diego Caltabiano",
            title: "Referente operativo",
            email: "diego@gustare.it",
            phone: "+39 333 1234567",
            clientId: "client-1",
            clientName: "MARIO ROSSI STUDIO",
            linkedProjects: [
              {
                projectId: "project-1",
                projectName: "Wedding Mario",
                status: "in_corso",
                statusLabel: "In corso",
                isPrimary: true,
              },
            ],
            updatedAt: "2026-02-21T09:30:00.000Z",
          },
        ],
        openQuotes: [
          {
            quoteId: "quote-1",
            clientId: "client-1",
            projectId: "project-1",
            clientName: "MARIO ROSSI STUDIO",
            projectName: "Wedding Mario",
            amount: 1200,
            linkedPaymentsTotal: 0,
            remainingAmount: 1200,
            status: "in_trattativa",
            statusLabel: "In trattativa",
            createdAt: "2026-02-20T10:00:00.000Z",
          },
        ],
        activeProjects: [
          {
            projectId: "project-1",
            clientId: "client-1",
            projectName: "Wedding Mario",
            clientName: "MARIO ROSSI STUDIO",
            status: "in_corso",
            statusLabel: "In corso",
            startDate: "2026-02-20T10:00:00.000Z",
            totalServices: 0,
            totalFees: 0,
            totalExpenses: 0,
            totalPaid: 0,
            balanceDue: 0,
            contacts: [
              {
                contactId: "101",
                displayName: "Diego Caltabiano",
                title: "Referente operativo",
                email: "diego@gustare.it",
                phone: "+39 333 1234567",
                isPrimary: true,
              },
            ],
          },
        ],
        pendingPayments: [
          {
            paymentId: "payment-1",
            quoteId: "quote-1",
            clientId: "client-1",
            projectId: "project-1",
            clientName: "MARIO ROSSI STUDIO",
            projectName: "Wedding Mario",
            amount: 800,
            status: "in_attesa",
            statusLabel: "In attesa",
            paymentDate: "2026-03-10T00:00:00.000Z",
          },
        ],
        recentExpenses: [
          {
            expenseId: "expense-1",
            clientId: null,
            projectId: null,
            clientName: null,
            projectName: null,
            amount: 300,
            expenseType: "noleggio",
            expenseTypeLabel: "Noleggio",
            expenseDate: "2026-02-18T00:00:00.000Z",
            description: "Noleggio luci",
          },
        ],
      },
      caveats: [],
    });

    getInvoiceImportWorkspace.mockResolvedValue({
      clients: [
        {
          id: "client-1",
          name: "Mario Rossi",
          email: "mario@example.com",
        },
      ],
      contacts: [],
      projects: [
        {
          id: "project-1",
          name: "Wedding Mario",
          client_id: "client-1",
        },
      ],
    });
  });

  it("opens on chat view and lets the user reach snapshot/import from the launcher menu", async () => {
    renderLauncher();

    const launcherButton = screen.getByRole("button", {
      name: "Apri chat AI unificata",
    });

    fireEvent.click(launcherButton);

    expect(await screen.findByText("Chat AI")).toBeInTheDocument();
    expect(
      screen.getByText("Dammi un riepilogo operativo rapido del CRM."),
    ).toBeInTheDocument();
    const composer = screen.getByTestId("unified-crm-composer");
    const composerMenuButton = within(composer).getByRole("button", {
      name: "Apri altre viste AI",
    });
    expect(
      within(composer).getByLabelText("Fai una domanda sul CRM corrente"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Snapshot CRM")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Documenti")).not.toBeInTheDocument();

    fireEvent.pointerDown(composerMenuButton);

    expect(
      await screen.findByRole("menuitem", { name: "Snapshot CRM" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Importa fatture e ricevute" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Snapshot CRM" }));

    expect(await screen.findByText("Pagamenti da seguire")).toBeInTheDocument();
    expect(await screen.findByText("Clienti recenti")).toBeInTheDocument();
    expect(await screen.findByText("Referenti recenti")).toBeInTheDocument();
    expect(
      (await screen.findAllByText("MARIO ROSSI STUDIO")).length,
    ).toBeGreaterThan(0);
    expect(await screen.findByText("Diego Caltabiano")).toBeInTheDocument();
    expect(await screen.findByText(/P\.IVA IT12345678901/)).toBeInTheDocument();
    expect(
      await screen.findByText(/PEC mario@examplepec.it/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Torna alla chat AI" }));

    expect(await screen.findByText("Chat AI")).toBeInTheDocument();
    await waitFor(() =>
      expect(getInvoiceImportWorkspace).toHaveBeenCalledTimes(1),
    );
    expect(getUnifiedCrmReadContext).toHaveBeenCalledTimes(1);
  });

  it("asks a read-only CRM question inside the launcher", async () => {
    askUnifiedCrmQuestion.mockResolvedValue({
      question: "Dammi un riepilogo operativo rapido del CRM.",
      model: "gpt-5.2",
      generatedAt: "2026-02-28T22:05:00.000Z",
      answerMarkdown:
        "## Risposta breve\nTutto sotto controllo.\n\n## Dati usati\n- 1 preventivo aperto.\n- 1 pagamento pendente.",
      paymentDraft: {
        id: "payment-draft-from-open-quote",
        resource: "payments",
        originActionId: "quote_create_payment",
        draftKind: "payment_create",
        label: "Bozza pagamento dal preventivo aperto",
        explanation:
          "Questa bozza usa il residuo ancora non collegato del preventivo aperto principale. Puoi correggerla qui e poi aprire il form pagamenti per confermare davvero.",
        quoteId: "quote-1",
        clientId: "client-1",
        projectId: "project-1",
        paymentType: "saldo",
        amount: 450,
        status: "in_attesa",
        href: "/#/payments/create?quote_id=quote-1&client_id=client-1&project_id=project-1&payment_type=saldo&amount=450&status=in_attesa&launcher_source=unified_ai_launcher&launcher_action=quote_create_payment&draft_kind=payment_create",
      },
      suggestedActions: [
        {
          id: "quote-create-payment-handoff",
          kind: "approved_action",
          resource: "payments",
          capabilityActionId: "quote_create_payment",
          label: "Registra pagamento dal preventivo",
          description: "Apre il form pagamenti precompilato dal preventivo.",
          recommended: true,
          recommendationReason:
            "Consigliata perche il preventivo rilevante e' in stato accettato e qui il pagamento si apre gia precompilato dal record corretto.",
          href: "/#/payments/create?quote_id=quote-1&client_id=client-1&project_id=project-1&launcher_action=quote_create_payment&launcher_source=unified_ai_launcher",
        },
        {
          id: "open-dashboard",
          kind: "page",
          resource: "dashboard",
          label: "Apri la dashboard",
          description: "Torna al quadro generale.",
          href: "/#/",
        },
      ],
    });

    renderLauncher();
    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    const suggestionText = await screen.findByText(
      "Dammi un riepilogo operativo rapido del CRM.",
    );
    const suggestionButton = suggestionText.closest("button")!;

    await waitFor(() => expect(suggestionButton).toBeEnabled());

    fireEvent.click(suggestionButton);

    await waitFor(() => expect(askUnifiedCrmQuestion).toHaveBeenCalledTimes(1));

    expect(askUnifiedCrmQuestion).toHaveBeenCalledWith(
      "Dammi un riepilogo operativo rapido del CRM.",
      expect.objectContaining({
        meta: expect.objectContaining({
          scope: "crm_read_snapshot",
        }),
      }),
      [],
    );

    expect(
      await screen.findByText("Tutto sotto controllo."),
    ).toBeInTheDocument();
    const answerPanel = await screen.findByTestId("unified-crm-answer");
    const composer = screen.getByTestId("unified-crm-composer");
    expect(
      answerPanel.compareDocumentPosition(composer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      await screen.findByText("Bozza pagamento proposta"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Azioni suggerite")).toBeInTheDocument();
    expect(
      screen.getByText("Registra pagamento dal preventivo"),
    ).toBeInTheDocument();
    expect(screen.getByText("Consigliata ora")).toBeInTheDocument();
    expect(screen.getByText("Azione approvata")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Consigliata perche il preventivo rilevante e' in stato accettato e qui il pagamento si apre gia precompilato dal record corretto.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Apri form pagamenti con questa bozza",
      }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("450")).toBeInTheDocument();
    expect(
      screen.getByText("Registra pagamento dal preventivo").closest("a"),
    ).toHaveAttribute(
      "href",
      "/#/payments/create?quote_id=quote-1&client_id=client-1&project_id=project-1&launcher_action=quote_create_payment&launcher_source=unified_ai_launcher",
    );
    expect(
      screen.getByText("Apri form pagamenti con questa bozza").closest("a"),
    ).toHaveAttribute(
      "href",
      "/#/payments/create?quote_id=quote-1&client_id=client-1&project_id=project-1&payment_type=saldo&amount=450&status=in_attesa&launcher_source=unified_ai_launcher&launcher_action=quote_create_payment&draft_kind=payment_create",
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(
      screen.queryByText("Tutto sotto controllo."),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    expect(
      await screen.findByText("Tutto sotto controllo."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Bozza pagamento proposta"),
    ).toBeInTheDocument();
    expect(askUnifiedCrmQuestion).toHaveBeenCalledTimes(1);
  });

  it("renders the km-expense handoff for a route-only travel question typed in chat", async () => {
    askUnifiedCrmQuestion.mockResolvedValue({
      question:
        "Calcola i km andata e ritorno per la tratta Valguarnera Caropepe (EN) - Catania.",
      model: "openrouteservice",
      generatedAt: "2026-03-01T06:30:00.000Z",
      answerMarkdown:
        "## Risposta breve\nPer la tratta Valguarnera Caropepe (EN) - Catania A/R ho stimato 160,98 km complessivi.\n\n## Dati usati\n- Origine risolta tramite routing come Valguarnera Caropepe, EN, Italy.\n- Destinazione risolta tramite routing come Catania, CT, Italy.\n\n## Limiti o prossima azione\n- Se vuoi registrarla nel CRM, usa l'azione suggerita per aprire Spese gia precompilata: la scrittura non parte direttamente dalla chat.",
      paymentDraft: null,
      suggestedActions: [
        {
          id: "expense-create-km-handoff",
          kind: "approved_action",
          resource: "expenses",
          capabilityActionId: "expense_create_km",
          label: "Registra questa spesa km",
          description:
            "Apre il form spese gia precompilato con tipo spostamento km, data, chilometri, tariffa e descrizione della tratta.",
          recommended: true,
          recommendationReason:
            "Consigliata perche la tratta e' gia stata risolta e i km possono essere corretti direttamente sulla superficie spese approvata prima del salvataggio.",
          href: "/#/expenses/create?expense_type=spostamento_km&expense_date=2026-03-01&km_distance=160.98&km_rate=0.19&description=Trasferta+Valguarnera+Caropepe+%28EN%29+-+Catania+A%2FR&launcher_source=unified_ai_launcher&launcher_action=expense_create_km",
        },
      ],
    });

    renderLauncher();
    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    const textarea = await screen.findByLabelText(
      "Fai una domanda sul CRM corrente",
    );
    fireEvent.change(textarea, {
      target: {
        value:
          "Calcola i km andata e ritorno per la tratta Valguarnera Caropepe (EN) - Catania.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invia" }));

    await waitFor(() => expect(askUnifiedCrmQuestion).toHaveBeenCalledTimes(1));

    expect(askUnifiedCrmQuestion).toHaveBeenCalledWith(
      "Calcola i km andata e ritorno per la tratta Valguarnera Caropepe (EN) - Catania.",
      expect.objectContaining({
        meta: expect.objectContaining({
          scope: "crm_read_snapshot",
        }),
      }),
      [],
    );

    expect(
      await screen.findByText(/160,98 km complessivi/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Registra questa spesa km").closest("a"),
    ).toHaveAttribute(
      "href",
      "/#/expenses/create?expense_type=spostamento_km&expense_date=2026-03-01&km_distance=160.98&km_rate=0.19&description=Trasferta+Valguarnera+Caropepe+%28EN%29+-+Catania+A%2FR&launcher_source=unified_ai_launcher&launcher_action=expense_create_km",
    );
    expect(screen.getByText("Consigliata ora")).toBeInTheDocument();
    expect(screen.getByText("Azione approvata")).toBeInTheDocument();
    expect(
      screen.queryByText("Bozza pagamento proposta"),
    ).not.toBeInTheDocument();
  });

  it("passes recent conversation turns back into the launcher AI and lets the user reset them", async () => {
    askUnifiedCrmQuestion
      .mockResolvedValueOnce({
        question: "Dammi un riepilogo operativo rapido del CRM.",
        model: "gpt-5.2",
        generatedAt: "2026-02-28T22:05:00.000Z",
        answerMarkdown: "## Risposta breve\nPrima risposta.",
        paymentDraft: null,
        suggestedActions: [],
      })
      .mockResolvedValueOnce({
        question: "E quindi cosa devo controllare per primo?",
        model: "gpt-5.2",
        generatedAt: "2026-02-28T22:06:00.000Z",
        answerMarkdown: "## Risposta breve\nSeconda risposta.",
        paymentDraft: null,
        suggestedActions: [],
      });

    renderLauncher();
    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    const firstSuggestionText = await screen.findByText(
      "Dammi un riepilogo operativo rapido del CRM.",
    );
    const firstSuggestion = firstSuggestionText.closest("button")!;
    await waitFor(() => expect(firstSuggestion).toBeEnabled());

    fireEvent.click(firstSuggestion);

    expect(await screen.findByTestId("unified-crm-answer")).toBeInTheDocument();

    const textarea = screen.getByLabelText("Fai una domanda sul CRM corrente");
    fireEvent.change(textarea, {
      target: { value: "E quindi cosa devo controllare per primo?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invia" }));

    await waitFor(() =>
      expect(screen.getAllByTestId("unified-crm-answer")).toHaveLength(1),
    );
    expect(askUnifiedCrmQuestion).toHaveBeenNthCalledWith(
      2,
      "E quindi cosa devo controllare per primo?",
      expect.objectContaining({
        meta: expect.objectContaining({
          scope: "crm_read_snapshot",
        }),
      }),
      [
        {
          question: "Dammi un riepilogo operativo rapido del CRM.",
          answerMarkdown: "## Risposta breve\nPrima risposta.",
          generatedAt: "2026-02-28T22:05:00.000Z",
          model: "gpt-5.2",
        },
      ],
    );

    fireEvent.click(screen.getByRole("button", { name: "Resetta chat AI" }));

    expect(screen.queryByTestId("unified-crm-answer")).not.toBeInTheDocument();
    expect(
      screen.getByText("Dammi un riepilogo operativo rapido del CRM."),
    ).toBeInTheDocument();
  });

  it("uploads files, generates a draft, and confirms the import", async () => {
    uploadInvoiceImportFiles.mockResolvedValue([
      {
        path: "ai-invoice-imports/fattura-1.pdf",
        name: "fattura-1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      },
    ]);
    generateInvoiceImportDraft.mockResolvedValue({
      model: "gemini-2.5-pro",
      generatedAt: "2026-02-28T22:00:00.000Z",
      summary: "Bozza pronta",
      warnings: [],
      records: [
        {
          id: "draft-1",
          sourceFileNames: ["fattura-1.pdf"],
          resource: "payments",
          confidence: "high",
          documentType: "customer_invoice",
          counterpartyName: "Mario Rossi",
          invoiceRef: "FAT-12",
          amount: 1200,
          documentDate: "2026-02-20",
          clientId: "client-1",
          projectId: "project-1",
          paymentType: "saldo",
          paymentMethod: "bonifico",
          paymentStatus: "in_attesa",
        },
      ],
    });
    confirmInvoiceImportDraft.mockResolvedValue({
      created: [
        {
          resource: "payments",
          id: "payment-1",
          invoiceRef: "FAT-12",
          amount: 1200,
        },
      ],
    });

    renderLauncher();
    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    fireEvent.pointerDown(
      await screen.findByRole("button", { name: "Apri altre viste AI" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "Importa fatture e ricevute",
      }),
    );

    const fileInput = await screen.findByLabelText("Documenti");
    const file = new File(["invoice"], "fattura-1.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Analizza documenti" }));

    expect(await screen.findByText("Bozza pronta")).toBeInTheDocument();
    expect(uploadInvoiceImportFiles).toHaveBeenCalledWith([file]);
    expect(generateInvoiceImportDraft).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Conferma import nel CRM" }),
    );

    await waitFor(() =>
      expect(confirmInvoiceImportDraft).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByText(/Import completato/)).toBeInTheDocument();

    // Close and reopen — import state and active view should be preserved
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    // Already on import view (activeView preserved), state is still there
    expect(await screen.findByText(/Import completato/)).toBeInTheDocument();

    // "Nuova" button resets the import workspace
    fireEvent.click(screen.getByRole("button", { name: "Nuovo import" }));

    expect(screen.queryByText("Bozza pronta")).not.toBeInTheDocument();
    expect(screen.queryByText(/Import completato/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Analizza documenti" }),
    ).toBeDisabled();
  });

  it("uses the full mobile viewport for the launcher drawer", async () => {
    useIsMobile.mockReturnValue(true);

    renderLauncher();
    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("inset-0");
    expect(dialog.className).toContain("h-dvh");
    expect(dialog.className).toContain("overflow-hidden");
    expect(dialog.className).toContain("rounded-none");
  });

  it("keeps a dedicated scroll area for mobile chat content", async () => {
    useIsMobile.mockReturnValue(true);

    renderLauncher();
    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    const scrollArea = await screen.findByTestId("unified-crm-scroll-area");
    const composer = screen.getByTestId("unified-crm-composer");

    expect(scrollArea.className).toContain("overflow-y-auto");
    expect(scrollArea.className).toContain("min-h-0");
    expect(scrollArea.className).toContain("[webkit-overflow-scrolling:touch]");
    expect(composer.className).toContain("shrink-0");
  });

  it("exposes the extended question length in both compact and expanded composers", async () => {
    renderLauncher();
    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    const compactTextarea = (await screen.findByLabelText(
      "Fai una domanda sul CRM corrente",
    )) as HTMLTextAreaElement;
    expect(compactTextarea.maxLength).toBe(unifiedCrmQuestionMaxLength);

    compactTextarea.style.lineHeight = "20px";
    compactTextarea.style.paddingTop = "0px";
    compactTextarea.style.paddingBottom = "0px";
    Object.defineProperty(compactTextarea, "scrollHeight", {
      configurable: true,
      get: () => 60,
    });

    fireEvent.change(compactTextarea, {
      target: { value: "riga 1\nriga 2\nriga 3" },
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Apri editor esteso per la domanda",
      }),
    );

    const expandedTextarea = screen.getAllByPlaceholderText(
      "Chiedi qualcosa sul CRM...",
    )[1] as HTMLTextAreaElement;
    expect(expandedTextarea.maxLength).toBe(unifiedCrmQuestionMaxLength);
  });

  it("shows the expanded-editor action from the third line and scrolls from the seventh", async () => {
    renderLauncher();
    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    const textarea = (await screen.findByLabelText(
      "Fai una domanda sul CRM corrente",
    )) as HTMLTextAreaElement;

    textarea.style.lineHeight = "20px";
    textarea.style.paddingTop = "0px";
    textarea.style.paddingBottom = "0px";
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => Math.max(1, textarea.value.split(/\r?\n/).length) * 20,
    });

    fireEvent.change(textarea, {
      target: {
        value: "riga 1\nriga 2\nriga 3",
      },
    });

    expect(
      await screen.findByRole("button", {
        name: "Apri editor esteso per la domanda",
      }),
    ).toBeInTheDocument();
    expect(textarea.style.overflowY).toBe("hidden");

    fireEvent.change(textarea, {
      target: {
        value: "riga 1\nriga 2\nriga 3\nriga 4\nriga 5\nriga 6\nriga 7",
      },
    });

    expect(textarea.style.overflowY).toBe("auto");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Apri editor esteso per la domanda",
      }),
    );

    expect(screen.getAllByDisplayValue(/riga 1/).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        "Continua a scrivere senza comprimere il composer della chat.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Il testo continua a restare nella stessa conversazione del launcher.",
      ),
    ).not.toBeInTheDocument();
  });

  it("also detects wrapped long text without explicit newlines", async () => {
    renderLauncher();
    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    const textarea = (await screen.findByLabelText(
      "Fai una domanda sul CRM corrente",
    )) as HTMLTextAreaElement;

    textarea.style.lineHeight = "normal";
    textarea.style.fontSize = "16px";
    textarea.style.paddingTop = "0px";
    textarea.style.paddingBottom = "0px";
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => {
        if (textarea.value.length >= 180) {
          return 168;
        }
        if (textarea.value.length >= 60) {
          return 72;
        }
        return 24;
      },
    });

    fireEvent.change(textarea, {
      target: {
        value:
          "Questo testo lungo non contiene invii manuali ma deve comunque far comparire l'azione di editor esteso.",
      },
    });

    expect(
      await screen.findByRole("button", {
        name: "Apri editor esteso per la domanda",
      }),
    ).toBeInTheDocument();
    expect(textarea.style.overflowY).toBe("hidden");

    fireEvent.change(textarea, {
      target: {
        value:
          "Questo testo molto piu lungo continua senza invii manuali ma deve essere trattato come sette righe equivalenti per far partire la scrollbar locale del composer compatto quando la domanda diventa davvero estesa e l'utente non ha ancora aperto l'editor full-screen.",
      },
    });

    expect(textarea.style.overflowY).toBe("auto");
  });

  it("treats whitespace-only wrapped input as visual content for composer thresholds", async () => {
    renderLauncher();
    fireEvent.click(
      screen.getByRole("button", { name: "Apri chat AI unificata" }),
    );

    const textarea = (await screen.findByLabelText(
      "Fai una domanda sul CRM corrente",
    )) as HTMLTextAreaElement;

    textarea.style.lineHeight = "normal";
    textarea.style.fontSize = "16px";
    textarea.style.paddingTop = "0px";
    textarea.style.paddingBottom = "0px";
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => {
        if (textarea.value.length >= 180) {
          return 168;
        }
        if (textarea.value.length >= 60) {
          return 72;
        }
        return 24;
      },
    });

    fireEvent.change(textarea, {
      target: {
        value: " ".repeat(80),
      },
    });

    expect(
      await screen.findByRole("button", {
        name: "Apri editor esteso per la domanda",
      }),
    ).toBeInTheDocument();
    expect(textarea.style.overflowY).toBe("hidden");

    fireEvent.change(textarea, {
      target: {
        value: " ".repeat(220),
      },
    });

    expect(textarea.style.overflowY).toBe("auto");
  });
});

import { describe, expect, it } from "vitest";

import { buildCrmCapabilityRegistry } from "./crmCapabilityRegistry";

describe("crmCapabilityRegistry", () => {
  it("declares core resources, dialogs and route mode for the AI layer", () => {
    const registry = buildCrmCapabilityRegistry();

    expect(registry.routing.mode).toBe("hash");
    expect(
      registry.dialogs.some(
        (dialog) => dialog.id === "unified_ai_launcher_sheet",
      ),
    ).toBe(true);
    expect(
      registry.dialogs.some(
        (dialog) => dialog.id === "unified_ai_composer_dialog",
      ),
    ).toBe(true);
    expect(
      registry.dialogs.some(
        (dialog) => dialog.id === "travel_route_calculator_dialog",
      ),
    ).toBe(true);
    expect(
      registry.dialogs.find(
        (dialog) => dialog.id === "unified_ai_composer_dialog",
      )?.description,
    ).toContain("terza riga");
    expect(
      registry.dialogs.find(
        (dialog) => dialog.id === "travel_route_calculator_dialog",
      )?.description,
    ).toContain("openrouteservice");
    expect(
      registry.resources.some(
        (resource) =>
          resource.resource === "quotes" &&
          resource.routePatterns.includes("/#/quotes/:id/show"),
      ),
    ).toBe(true);
    expect(
      registry.resources.some(
        (resource) =>
          resource.resource === "invoicing" &&
          resource.supportedViews.length === 0,
      ),
    ).toBe(true);
    expect(
      registry.dialogs.some(
        (dialog) => dialog.id === "create_project_from_quote_dialog",
      ),
    ).toBe(true);
    expect(
      registry.actions.some((action) => action.id === "client_create_payment"),
    ).toBe(true);
    expect(
      registry.actions.some((action) => action.id === "service_create"),
    ).toBe(true);
    expect(
      registry.actions.some((action) => action.id === "expense_create"),
    ).toBe(true);
    expect(
      registry.actions.some(
        (action) => action.id === "open_unified_ai_launcher",
      ),
    ).toBe(true);
    expect(
      registry.actions.find(
        (action) => action.id === "open_unified_ai_launcher",
      )?.description,
    ).toContain("riaperto");
    expect(
      registry.actions.some(
        (action) => action.id === "read_unified_crm_context",
      ),
    ).toBe(true);
    expect(
      registry.actions.find((action) => action.id === "read_unified_crm_context")
        ?.description,
    ).toContain("profilo fiscale");
    expect(
      registry.actions.find((action) => action.id === "read_unified_crm_context")
        ?.description,
    ).toContain("fornitori");
    expect(
      registry.actions.some((action) => action.id === "ask_unified_crm_question"),
    ).toBe(true);
    expect(
      registry.actions.some(
        (action) => action.id === "prepare_payment_write_draft",
      ),
    ).toBe(true);
    expect(
      registry.actions.some((action) => action.id === "follow_unified_crm_handoff"),
    ).toBe(true);
    expect(
      registry.actions.find(
        (action) => action.id === "follow_unified_crm_handoff",
      )?.requiredFields,
    ).toContain("answer.suggestedActions[].capabilityActionId");
    expect(
      registry.actions.find(
        (action) => action.id === "follow_unified_crm_handoff",
      )?.requiredFields,
    ).toContain("answer.suggestedActions[].recommended");
    expect(
      registry.actions.find(
        (action) => action.id === "follow_unified_crm_handoff",
      )?.description,
    ).toContain("prefills/search params");
    expect(
      registry.actions.find((action) => action.id === "quote_create_payment")
        ?.description,
    ).toContain("residuo");
    expect(
      registry.actions.find(
        (action) => action.id === "prepare_payment_write_draft",
      )?.requiredFields,
    ).toContain("answer.paymentDraft.amount");
    expect(
      registry.actions.find(
        (action) => action.id === "prepare_payment_write_draft",
      )?.description,
    ).toContain("preservare");
    expect(
      registry.actions.find(
        (action) => action.id === "prepare_payment_write_draft",
      )?.description,
    ).toContain("stesso preventivo");
    expect(
      registry.actions.find(
        (action) => action.id === "prepare_payment_write_draft",
      )?.description,
    ).toContain("segnalando");
    expect(
      registry.actions.find(
        (action) => action.id === "prepare_payment_write_draft",
      )?.description,
    ).toContain("ricalcolo automatico");
    expect(
      registry.actions.find(
        (action) => action.id === "prepare_payment_write_draft",
      )?.requiredFields,
    ).toContain("answer.paymentDraft.originActionId");
    expect(
      registry.actions.find(
        (action) => action.id === "prepare_payment_write_draft",
      )?.requiredFields,
    ).toContain("answer.paymentDraft.draftKind");
    expect(
      registry.actions.find(
        (action) => action.id === "prepare_payment_write_draft",
      )?.description,
    ).toContain("project quick payment");
    expect(
      registry.actions.find((action) => action.id === "project_quick_payment")
        ?.description,
    ).toContain("importo e stato");
    expect(
      registry.actions.find((action) => action.id === "service_create")
        ?.description,
    ).toContain("services/create");
    expect(
      registry.actions.find((action) => action.id === "expense_create")
        ?.description,
    ).toContain("cliente, progetto se presente");
    expect(
      registry.actions.find((action) => action.id === "project_quick_episode")
        ?.sideEffects,
    ).toContain("crea spese extra se aggiunte nel dialog");
    expect(
      registry.actions.some((action) => action.id === "estimate_travel_route"),
    ).toBe(true);
    expect(
      registry.actions.find((action) => action.id === "estimate_travel_route")
        ?.requiredFields,
    ).toContain("tripMode");
    expect(
      registry.actions.find((action) => action.id === "estimate_travel_route")
        ?.description,
    ).toContain("spese, servizi e puntate rapide");
    expect(
      registry.actions.some((action) => action.id === "invoice_import_extract"),
    ).toBe(true);
    expect(
      registry.actions.some(
        (action) => action.id === "invoice_import_open_client_create",
      ),
    ).toBe(true);
    expect(
      registry.actions.find(
        (action) => action.id === "invoice_import_open_client_create",
      )?.description,
    ).toContain("precompilato");
    expect(
      registry.actions.some((action) => action.id === "invoice_import_confirm"),
    ).toBe(true);
    expect(
      registry.pages.some(
        (page) =>
          page.id === "settings" &&
          page.description.includes("AI analitica/read-only CRM"),
      ),
    ).toBe(true);
  });

  it("exposes communication templates and future integration checklist", () => {
    const registry = buildCrmCapabilityRegistry();

    expect(
      registry.communications.quoteStatusEmails.templates.some(
        (template) => template.status === "preventivo_inviato",
      ),
    ).toBe(true);
    expect(
      registry.communications.quoteStatusEmails.safetyRules.some((rule) =>
        rule.includes("is_taxable = false"),
      ),
    ).toBe(true);
    expect(registry.communications.quoteStatusEmails.provider).toBe(
      "gmail_smtp",
    );
    expect(registry.communications.quoteStatusEmails.requiredEnvKeys).toEqual([
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
    ]);
    expect(registry.communications.internalPriorityNotifications.provider).toBe(
      "callmebot",
    );
    expect(
      registry.communications.internalPriorityNotifications.requiredEnvKeys,
    ).toEqual(["CALLMEBOT_PHONE", "CALLMEBOT_APIKEY"]);
    expect(
      registry.integrationChecklist.map((item) => item.id),
    ).toContain("capability-registry");
    expect(
      registry.integrationChecklist.map((item) => item.id),
    ).toContain("communications");
    expect(
      registry.actions.some((action) => action.id === "quote_send_status_email"),
    ).toBe(true);
  });
});

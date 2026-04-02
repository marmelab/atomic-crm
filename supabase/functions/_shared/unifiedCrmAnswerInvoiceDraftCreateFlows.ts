import type {
  ParsedUnifiedCrmInvoiceDraftQuestion,
  UnifiedCrmSuggestedAction,
} from "./unifiedCrmAnswerTypes.ts";
import {
  hasInvoiceDraftIntent,
  pickClientFromQuestion,
  pickProjectFromQuestion,
} from "./unifiedCrmAnswerIntents.ts";
import {
  buildShowHrefWithSearch,
  formatNumber,
  getRoutePrefix,
  getString,
  includesAny,
  normalizeText,
} from "./unifiedCrmAnswerUtils.ts";
import {
  invoiceDraftResourceMap,
  invoiceDraftSurfaceLabelMap,
} from "./unifiedCrmAnswerCreateFlowShared.ts";
import {
  buildClientInvoiceDraftQuestion,
  buildProjectInvoiceDraftQuestion,
  buildQuoteInvoiceDraftQuestion,
  getInvoiceDraftSnapshotCollections,
  type SnapshotCollections,
} from "./unifiedCrmAnswerInvoiceDraftShared.ts";

const invoiceDraftSearchParams = { invoiceDraft: "true" } as const;

const buildInvoiceFinancialLines = (
  financials: ParsedUnifiedCrmInvoiceDraftQuestion["financials"],
) => {
  if (!financials) {
    return [];
  }

  return [
    "## Dettaglio finanziario",
    "",
    `- **Compensi**: ${formatNumber(financials.totalFees)} EUR`,
    ...(financials.totalExpenses > 0
      ? [`- **Spese**: ${formatNumber(financials.totalExpenses)} EUR`]
      : []),
    `- **Gia pagato**: ${formatNumber(financials.totalPaid)} EUR`,
    ...(financials.balanceDue > 0
      ? [`- **Da incassare**: ${formatNumber(financials.balanceDue)} EUR`]
      : []),
    financials.hasUninvoicedServices
      ? "- Ci sono servizi non ancora fatturati."
      : "- Tutti i servizi risultano gia fatturati.",
    "",
  ];
};

const buildInvoiceDraftAction = ({
  id,
  resource,
  label,
  description,
  href,
  recommended,
  recommendationReason,
}: {
  id: string;
  resource: "quotes" | "projects" | "clients";
  label: string;
  description: string;
  href: string | null;
  recommended?: boolean;
  recommendationReason?: string;
}): UnifiedCrmSuggestedAction | null =>
  href
    ? {
        id,
        kind: "approved_action",
        resource,
        capabilityActionId: "generate_invoice_draft",
        label,
        description,
        href,
        recommended,
        recommendationReason,
      }
    : null;

const buildInvoiceDraftShowHref = ({
  routePrefix,
  resource,
  recordId,
}: {
  routePrefix: string;
  resource: "quotes" | "projects" | "clients";
  recordId: string | null;
}) =>
  buildShowHrefWithSearch(
    routePrefix,
    resource,
    recordId,
    invoiceDraftSearchParams,
  );

const buildInvoicePrimaryAction = ({
  routePrefix,
  parsedQuestion,
}: {
  routePrefix: string;
  parsedQuestion: ParsedUnifiedCrmInvoiceDraftQuestion;
}) =>
  buildInvoiceDraftAction({
    id: `invoice-draft-${parsedQuestion.surface}-handoff`,
    resource: invoiceDraftResourceMap[parsedQuestion.surface],
    label: `Genera bozza fattura da ${invoiceDraftSurfaceLabelMap[parsedQuestion.surface]}`,
    description: `Apre ${parsedQuestion.entityLabel} con il dialog bozza fattura gia visibile — da li puoi scaricare PDF e XML.`,
    href: buildInvoiceDraftShowHref({
      routePrefix,
      resource: invoiceDraftResourceMap[parsedQuestion.surface],
      recordId: parsedQuestion.recordId,
    }),
    recommended: true,
    recommendationReason: `Consigliata perche apre direttamente la bozza fattura dalla superficie piu pertinente (${invoiceDraftSurfaceLabelMap[parsedQuestion.surface]}).`,
  });

const buildInvoiceClientFallbackAction = ({
  routePrefix,
  parsedQuestion,
}: {
  routePrefix: string;
  parsedQuestion: ParsedUnifiedCrmInvoiceDraftQuestion;
}) => {
  if (parsedQuestion.surface === "client") {
    return null;
  }

  return buildInvoiceDraftAction({
    id: "invoice-draft-client-fallback",
    resource: "clients",
    label: "Bozza fattura dal cliente",
    description:
      "Aggrega tutti i servizi non fatturati del cliente in un'unica bozza.",
    href: buildInvoiceDraftShowHref({
      routePrefix,
      resource: "clients",
      recordId: parsedQuestion.clientId,
    }),
  });
};

const buildInvoiceProjectFallbackAction = ({
  routePrefix,
  activeProjects,
  parsedQuestion,
}: {
  routePrefix: string;
  activeProjects: SnapshotCollections["activeProjects"];
  parsedQuestion: ParsedUnifiedCrmInvoiceDraftQuestion;
}) => {
  if (parsedQuestion.surface === "project") {
    return null;
  }

  const project = activeProjects.find(
    (item) => getString(item.clientId) === parsedQuestion.clientId,
  );

  return buildInvoiceDraftAction({
    id: "invoice-draft-project-fallback",
    resource: "projects",
    label: "Bozza fattura dal progetto",
    description:
      "Genera la bozza solo dai servizi del progetto attivo collegato.",
    href: buildInvoiceDraftShowHref({
      routePrefix,
      resource: "projects",
      recordId: getString(project?.projectId),
    }),
  });
};

const buildInvoiceQuoteFallbackAction = ({
  routePrefix,
  openQuotes,
  parsedQuestion,
}: {
  routePrefix: string;
  openQuotes: SnapshotCollections["openQuotes"];
  parsedQuestion: ParsedUnifiedCrmInvoiceDraftQuestion;
}) => {
  if (parsedQuestion.surface === "quote") {
    return null;
  }

  const quote = openQuotes.find(
    (item) => getString(item.clientId) === parsedQuestion.clientId,
  );

  return buildInvoiceDraftAction({
    id: "invoice-draft-quote-fallback",
    resource: "quotes",
    label: "Bozza fattura dal preventivo",
    description:
      "Genera la bozza dall'importo del preventivo, al netto dei pagamenti ricevuti.",
    href: buildInvoiceDraftShowHref({
      routePrefix,
      resource: "quotes",
      recordId: getString(quote?.quoteId),
    }),
  });
};

export const parseUnifiedCrmInvoiceDraftQuestion = ({
  question,
  context,
}: {
  question: string;
  context: Record<string, unknown>;
}): ParsedUnifiedCrmInvoiceDraftQuestion | null => {
  const normalizedQuestion = normalizeText(question);

  if (!hasInvoiceDraftIntent(normalizedQuestion)) {
    return null;
  }

  const { openQuotes, activeProjects, recentClients } =
    getInvoiceDraftSnapshotCollections(context);
  const matchedClient = pickClientFromQuestion({
    normalizedQuestion,
    context,
  });
  const matchedProject = pickProjectFromQuestion({
    normalizedQuestion,
    context,
  });
  const matchedClientId = getString(matchedClient?.clientId);
  const matchedProjectId = getString(matchedProject?.projectId);
  const mentionsQuote = includesAny(normalizedQuestion, [
    "preventiv",
    "offert",
  ]);
  const shouldPreferQuote =
    mentionsQuote || (!matchedProjectId && !matchedClientId);

  if (shouldPreferQuote) {
    const quoteQuestion = buildQuoteInvoiceDraftQuestion({
      context,
      openQuotes,
      matchedClient,
      matchedClientId,
      matchedProjectId,
    });

    if (quoteQuestion) {
      return quoteQuestion;
    }

    if (mentionsQuote) {
      return null;
    }
  }

  return (
    buildProjectInvoiceDraftQuestion({
      context,
      activeProjects,
      recentClients,
      matchedClient,
      matchedProject,
      matchedClientId,
      matchedProjectId,
    }) ??
    buildClientInvoiceDraftQuestion({
      context,
      recentClients,
      matchedClient,
    })
  );
};

export const buildUnifiedCrmInvoiceDraftAnswerMarkdown = ({
  parsedQuestion,
}: {
  parsedQuestion: ParsedUnifiedCrmInvoiceDraftQuestion;
}) =>
  [
    "## Risposta",
    "",
    `Ti apro la scheda ${invoiceDraftSurfaceLabelMap[parsedQuestion.surface]} **${parsedQuestion.entityLabel}** con la bozza fattura gia pronta.`,
    "La bozza e un riferimento interno per compilare la fattura su Aruba — nessuna scrittura nel DB.",
    "",
    ...buildInvoiceFinancialLines(parsedQuestion.financials),
    "## Note",
    "",
    `- Nella scheda ${invoiceDraftSurfaceLabelMap[parsedQuestion.surface]} trovi il bottone **Bozza fattura** per generare PDF e XML FatturaPA.`,
    "- Il PDF e la bozza commerciale, l'XML e pronto per il caricamento su Aruba.",
    "- Per l'XML serve inserire il numero fattura nel campo dedicato.",
    ...(parsedQuestion.surface === "client" &&
    parsedQuestion.financials?.hasUninvoicedServices
      ? [
          "- La bozza dal cliente aggrega TUTTI i servizi non fatturati — controlla che sia quello che vuoi.",
        ]
      : []),
  ]
    .join("\n")
    .trim();

export const buildUnifiedCrmInvoiceDraftSuggestedActions = ({
  context,
  parsedQuestion,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmInvoiceDraftQuestion;
}): UnifiedCrmSuggestedAction[] => {
  const routePrefix = getRoutePrefix(context);
  const { openQuotes, activeProjects } =
    getInvoiceDraftSnapshotCollections(context);

  return [
    buildInvoicePrimaryAction({
      routePrefix,
      parsedQuestion,
    }),
    buildInvoiceClientFallbackAction({
      routePrefix,
      parsedQuestion,
    }),
    buildInvoiceProjectFallbackAction({
      routePrefix,
      activeProjects,
      parsedQuestion,
    }),
    buildInvoiceQuoteFallbackAction({
      routePrefix,
      openQuotes,
      parsedQuestion,
    }),
  ]
    .filter((item): item is UnifiedCrmSuggestedAction => item != null)
    .slice(0, 3);
};

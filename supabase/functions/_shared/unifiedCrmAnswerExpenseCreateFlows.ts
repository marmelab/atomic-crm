import type {
  ParsedUnifiedCrmExpenseCreateQuestion,
  UnifiedCrmSuggestedAction,
} from "./unifiedCrmAnswerTypes.ts";
import {
  inferAmountFromQuestion,
  inferDateFromQuestion,
  inferExpenseDescriptionFromQuestion,
  inferExpenseTypeFromQuestion,
  hasExpenseCreationIntent,
  hasTravelIntent,
  pickClientFromQuestion,
  pickProjectFromQuestion,
} from "./unifiedCrmAnswerIntents.ts";
import {
  buildCreateHref,
  buildShowHref,
  formatIsoDateForHumans,
  formatNumber,
  getBusinessTimezone,
  getRoutePrefix,
  getString,
  includesAny,
  normalizeText,
} from "./unifiedCrmAnswerUtils.ts";

export const parseUnifiedCrmExpenseCreateQuestion = ({
  question,
  context,
}: {
  question: string;
  context: Record<string, unknown>;
}): ParsedUnifiedCrmExpenseCreateQuestion | null => {
  const normalizedQuestion = normalizeText(question);
  const mentionsNonKmExpense = includesAny(normalizedQuestion, [
    "casell",
    "pranz",
    "cena",
    "carbur",
    "benzin",
    "diesel",
    "nolegg",
    "material",
    "attrezz",
    "acquist",
  ]);

  if (
    !hasExpenseCreationIntent(normalizedQuestion) ||
    (hasTravelIntent(normalizedQuestion) && !mentionsNonKmExpense)
  ) {
    return null;
  }

  const matchedProject = pickProjectFromQuestion({
    normalizedQuestion,
    context,
  });
  const matchedClient =
    matchedProject == null
      ? pickClientFromQuestion({
          normalizedQuestion,
          context,
        })
      : null;
  const clientId =
    getString(matchedProject?.clientId) ?? getString(matchedClient?.clientId);

  if (!clientId) {
    return null;
  }

  return {
    clientId,
    projectId: getString(matchedProject?.projectId),
    clientName:
      getString(matchedProject?.clientName) ??
      getString(matchedClient?.clientName),
    projectName: getString(matchedProject?.projectName),
    expenseDate: inferDateFromQuestion(
      question,
      normalizedQuestion,
      getBusinessTimezone(context),
    ),
    expenseType: inferExpenseTypeFromQuestion(normalizedQuestion),
    description: inferExpenseDescriptionFromQuestion(
      question,
      normalizedQuestion,
    ),
    amount: inferAmountFromQuestion(question),
    markupPercent: 0,
  };
};

export const buildExpenseCreateHref = ({
  context,
  parsedQuestion,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmExpenseCreateQuestion;
}) =>
  buildCreateHref(getRoutePrefix(context), "expenses", {
    client_id: parsedQuestion.clientId,
    project_id: parsedQuestion.projectId,
    expense_date: parsedQuestion.expenseDate,
    expense_type: parsedQuestion.expenseType,
    amount:
      parsedQuestion.amount != null ? String(parsedQuestion.amount) : undefined,
    markup_percent:
      parsedQuestion.markupPercent != null
        ? String(parsedQuestion.markupPercent)
        : undefined,
    description: parsedQuestion.description,
    launcher_source: "unified_ai_launcher",
    launcher_action: "expense_create",
  });

export const buildUnifiedCrmExpenseCreateAnswerMarkdown = ({
  parsedQuestion,
}: {
  parsedQuestion: ParsedUnifiedCrmExpenseCreateQuestion;
}) => {
  const targetLabel = parsedQuestion.projectName
    ? `cliente ${parsedQuestion.clientName ?? "collegato"} e progetto ${parsedQuestion.projectName}`
    : `cliente ${parsedQuestion.clientName ?? "collegato"}`;
  const dateLabel = formatIsoDateForHumans(parsedQuestion.expenseDate);
  const amountLabel =
    parsedQuestion.amount != null
      ? ` da ${formatNumber(parsedQuestion.amount)} EUR`
      : "";

  return [
    "## Risposta breve",
    `Da qui non salvo direttamente, ma ti apro Spese gia collegata a ${targetLabel}${parsedQuestion.description ? ` per registrare ${parsedQuestion.description.toLowerCase()}` : " per registrare la spesa"}${amountLabel}${dateLabel ? ` del ${dateLabel}` : ""}.`,
    "",
    "## Dati usati",
    ...(parsedQuestion.projectName
      ? [
          `- Ho collegato la spesa al progetto ${parsedQuestion.projectName}, quindi nel form arriveranno sia progetto sia cliente.`,
        ]
      : [
          "- Ho collegato la spesa direttamente al cliente, senza forzare un progetto che non emerge con certezza dalla snapshot.",
        ]),
    ...(parsedQuestion.description
      ? [
          `- Dalla richiesta ho estratto la descrizione operativa "${parsedQuestion.description}".`,
        ]
      : []),
    ...(parsedQuestion.amount != null
      ? [
          `- Importo letto dalla richiesta: ${formatNumber(parsedQuestion.amount)} EUR.`,
        ]
      : []),
    "",
    "## Limiti o prossima azione",
    "- La chat resta read-only: la scrittura reale parte solo dal form Spese con conferma esplicita.",
    "- Prima di salvare puoi ancora correggere tipo spesa, importo, data e collegamenti.",
  ].join("\n");
};

export const buildUnifiedCrmExpenseCreateSuggestedActions = ({
  context,
  parsedQuestion,
}: {
  context: Record<string, unknown>;
  parsedQuestion: ParsedUnifiedCrmExpenseCreateQuestion;
}): UnifiedCrmSuggestedAction[] => {
  const routePrefix = getRoutePrefix(context);
  const projectHref = buildShowHref(
    routePrefix,
    "projects",
    parsedQuestion.projectId,
  );
  const clientHref = buildShowHref(
    routePrefix,
    "clients",
    parsedQuestion.clientId,
  );

  return [
    {
      id: "expense-create-generic-handoff",
      kind: "approved_action",
      resource: "expenses",
      capabilityActionId: "expense_create",
      label: "Apri Spese e registra questa uscita",
      description:
        "Apre il form spese gia precompilato con cliente, progetto se presente, data, tipo, importo e descrizione letti dalla richiesta.",
      href: buildExpenseCreateHref({
        context,
        parsedQuestion,
      }),
      recommended: true,
      recommendationReason:
        "Consigliata perche usa la superficie Spese gia approvata e mantiene il legame corretto con cliente o cliente+progetto senza inventare nuovi form.",
    },
    ...(projectHref
      ? [
          {
            id: "open-project-from-expense-create-context",
            kind: "show" as const,
            resource: "projects" as const,
            capabilityActionId: "follow_unified_crm_handoff" as const,
            label: "Apri il progetto collegato",
            description:
              "Vai alla scheda progetto se vuoi controllare prima il contesto operativo.",
            href: projectHref,
          },
        ]
      : clientHref
        ? [
            {
              id: "open-client-from-expense-create-context",
              kind: "show" as const,
              resource: "clients" as const,
              capabilityActionId: "follow_unified_crm_handoff" as const,
              label: "Apri il cliente collegato",
              description:
                "Vai alla scheda cliente se vuoi verificare il contesto prima del salvataggio.",
              href: clientHref,
            },
          ]
        : []),
  ];
};

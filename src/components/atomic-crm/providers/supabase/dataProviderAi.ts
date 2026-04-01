import type {
  ClientCommercialPosition,
  ClientTask,
  Contact,
  Client,
  Expense,
  Payment,
  ProjectContact,
  ProjectFinancialRow,
  Project,
  Quote,
  Service,
  Supplier,
  Workflow,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import {
  buildUnifiedCrmReadContext,
  type UnifiedCrmReadContext,
} from "@/lib/ai/unifiedCrmReadContext";
import type {
  UnifiedCrmAnswer,
  UnifiedCrmConversationTurn,
} from "@/lib/ai/unifiedCrmAssistant";
import {
  buildCrmSemanticRegistry,
  type CrmSemanticRegistry,
} from "@/lib/semantics/crmSemanticRegistry";
import { buildCrmCapabilityRegistry } from "@/lib/semantics/crmCapabilityRegistry";
import { extractEdgeFunctionErrorMessage } from "./edgeFunctionError";
import {
  LARGE_PAGE,
  type BaseProvider,
  type InvokeEdgeFunction,
} from "./dataProviderTypes";

export const buildAiProviderMethods = (deps: {
  baseDataProvider: BaseProvider;
  invokeEdgeFunction: InvokeEdgeFunction;
  getConfiguredHistoricalAnalysisModel: () => Promise<string>;
}) => {
  const getUnifiedCrmReadContextFromResources =
    async (): Promise<UnifiedCrmReadContext> => {
      const [
        configuration,
        clientsResponse,
        contactsResponse,
        quotesResponse,
        projectsResponse,
        projectContactsResponse,
        servicesResponse,
        paymentsResponse,
        expensesResponse,
        suppliersResponse,
        tasksResponse,
        workflowsResponse,
        projectFinancialsResponse,
        clientCommercialPositionsResponse,
      ] = await Promise.all([
        deps.baseDataProvider.getOne("configuration", { id: 1 }),
        deps.baseDataProvider.getList<Client>("clients", {
          pagination: LARGE_PAGE,
          sort: { field: "created_at", order: "DESC" },
          filter: {},
        }),
        deps.baseDataProvider.getList<Contact>("contacts", {
          pagination: LARGE_PAGE,
          sort: { field: "updated_at", order: "DESC" },
          filter: {},
        }),
        deps.baseDataProvider.getList<Quote>("quotes", {
          pagination: LARGE_PAGE,
          sort: { field: "created_at", order: "DESC" },
          filter: {},
        }),
        deps.baseDataProvider.getList<Project>("projects", {
          pagination: LARGE_PAGE,
          sort: { field: "created_at", order: "DESC" },
          filter: {},
        }),
        deps.baseDataProvider.getList<ProjectContact>("project_contacts", {
          pagination: LARGE_PAGE,
          sort: { field: "updated_at", order: "DESC" },
          filter: {},
        }),
        deps.baseDataProvider.getList<Service>("services", {
          pagination: LARGE_PAGE,
          sort: { field: "service_date", order: "DESC" },
          filter: {},
        }),
        deps.baseDataProvider.getList<Payment>("payments", {
          pagination: LARGE_PAGE,
          sort: { field: "payment_date", order: "DESC" },
          filter: {},
        }),
        deps.baseDataProvider.getList<Expense>("expenses", {
          pagination: LARGE_PAGE,
          sort: { field: "expense_date", order: "DESC" },
          filter: {},
        }),
        deps.baseDataProvider.getList<Supplier>("suppliers", {
          pagination: LARGE_PAGE,
          sort: { field: "created_at", order: "DESC" },
          filter: {},
        }),
        deps.baseDataProvider.getList<ClientTask>("client_tasks", {
          pagination: LARGE_PAGE,
          sort: { field: "due_date", order: "ASC" },
          filter: { "done_date@is": null },
        }),
        deps.baseDataProvider.getList<Workflow>("workflows", {
          pagination: LARGE_PAGE,
          sort: { field: "created_at", order: "ASC" },
          filter: { "is_active@eq": true },
        }),
        deps.baseDataProvider.getList<ProjectFinancialRow>(
          "project_financials",
          {
            pagination: LARGE_PAGE,
            sort: { field: "project_name", order: "ASC" },
            filter: {},
          },
        ),
        deps.baseDataProvider.getList<ClientCommercialPosition>(
          "client_commercial_position",
          {
            pagination: LARGE_PAGE,
            sort: { field: "client_name", order: "ASC" },
            filter: {},
          },
        ),
      ]);

      const config =
        (configuration.data?.config as ConfigurationContextValue | undefined) ??
        {};

      return buildUnifiedCrmReadContext({
        clients: clientsResponse.data,
        contacts: contactsResponse.data,
        quotes: quotesResponse.data,
        projects: projectsResponse.data,
        projectContacts: projectContactsResponse.data,
        services: servicesResponse.data,
        payments: paymentsResponse.data,
        expenses: expensesResponse.data,
        projectFinancialRows: projectFinancialsResponse.data,
        clientCommercialPositions: clientCommercialPositionsResponse.data,
        suppliers: suppliersResponse.data,
        tasks: tasksResponse.data,
        workflows: workflowsResponse.data,
        semanticRegistry: buildCrmSemanticRegistry(config),
        capabilityRegistry: buildCrmCapabilityRegistry(),
      });
    };

  return {
    async getCrmSemanticRegistry(): Promise<CrmSemanticRegistry> {
      const { data } = await deps.baseDataProvider.getOne("configuration", {
        id: 1,
      });
      const config =
        (data?.config as ConfigurationContextValue | undefined) ?? {};
      return buildCrmSemanticRegistry(config);
    },
    async getUnifiedCrmReadContext(): Promise<UnifiedCrmReadContext> {
      return getUnifiedCrmReadContextFromResources();
    },
    async askUnifiedCrmQuestion(
      question: string,
      context: UnifiedCrmReadContext,
      conversationHistory: UnifiedCrmConversationTurn[] = [],
    ): Promise<UnifiedCrmAnswer> {
      const trimmedQuestion = question.trim();

      if (!trimmedQuestion) {
        throw new Error("Scrivi una domanda prima di inviare la richiesta.");
      }

      const model = await deps.getConfiguredHistoricalAnalysisModel();

      const edgeFunctionCall = deps.invokeEdgeFunction<{
        data: UnifiedCrmAnswer;
      }>("unified_crm_answer", {
        method: "POST",
        body: {
          context,
          question: trimmedQuestion,
          model,
          conversationHistory,
        },
      });

      const timeoutMs = 30_000;
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "La risposta AI sta impiegando troppo tempo. Riprova con una domanda più breve.",
              ),
            ),
          timeoutMs,
        );
      });

      const { data, error } = await Promise.race([edgeFunctionCall, timeout]);

      if (!data || error) {
        console.error("askUnifiedCrmQuestion.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile ottenere una risposta AI sul CRM unificato",
          ),
        );
      }

      return data.data;
    },
  };
};

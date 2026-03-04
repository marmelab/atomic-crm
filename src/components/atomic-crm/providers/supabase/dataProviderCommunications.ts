import type { Identifier } from "ra-core";
import type { Client, Payment, Project, Quote, Service } from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import {
  buildQuoteStatusEmailContext,
  type QuoteStatusEmailContext,
} from "@/lib/communications/quoteStatusEmailContext";
import type {
  QuoteStatusEmailSendRequest,
  QuoteStatusEmailSendResponse,
} from "@/lib/communications/quoteStatusEmailTemplates";
import type {
  PaymentReminderEmailSendRequest,
  PaymentReminderEmailSendResponse,
} from "@/lib/communications/paymentReminderEmailTypes";
import type {
  WorkflowNotifyPayload,
  WorkflowNotifyResponse,
} from "@/lib/communications/workflowNotifyTypes";
import { extractEdgeFunctionErrorMessage } from "./edgeFunctionError";
import type { BaseProvider, InvokeEdgeFunction } from "./dataProviderTypes";

export const buildCommunicationsProviderMethods = (deps: {
  baseDataProvider: BaseProvider;
  invokeEdgeFunction: InvokeEdgeFunction;
}) => {
  const getQuoteStatusEmailContextFromResources = async (
    quoteId: Identifier,
  ) => {
    const quoteResponse = await deps.baseDataProvider.getOne<Quote>("quotes", {
      id: quoteId,
    });
    const quote = quoteResponse.data;
    const configurationPromise = deps.baseDataProvider.getOne("configuration", {
      id: 1,
    });

    const [
      configurationResponse,
      clientResponse,
      projectResponse,
      paymentsResponse,
      servicesResponse,
    ] = await Promise.all([
      configurationPromise,
      quote.client_id
        ? deps.baseDataProvider.getOne<Client>("clients", {
            id: quote.client_id,
          })
        : Promise.resolve({ data: null }),
      quote.project_id
        ? deps.baseDataProvider.getOne<Project>("projects", {
            id: quote.project_id,
          })
        : Promise.resolve({ data: null }),
      deps.baseDataProvider.getList<Payment>("payments", {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "payment_date", order: "DESC" },
        filter: { "quote_id@eq": quote.id },
      }),
      quote.project_id
        ? deps.baseDataProvider.getList<Service>("services", {
            pagination: { page: 1, perPage: 1000 },
            sort: { field: "service_date", order: "ASC" },
            filter: { "project_id@eq": quote.project_id },
          })
        : Promise.resolve({ data: [] }),
    ]);

    const configuration =
      (configurationResponse.data?.config as
        | ConfigurationContextValue
        | undefined) ?? {};

    return buildQuoteStatusEmailContext({
      quote,
      client: clientResponse.data,
      project: projectResponse.data,
      payments: paymentsResponse.data,
      services: servicesResponse.data,
      configuration,
    });
  };

  return {
    async getQuoteStatusEmailContext(
      quoteId: Identifier,
    ): Promise<QuoteStatusEmailContext> {
      return getQuoteStatusEmailContextFromResources(quoteId);
    },
    async sendQuoteStatusEmail(
      request: QuoteStatusEmailSendRequest,
    ): Promise<QuoteStatusEmailSendResponse> {
      if (request.automatic && request.hasNonTaxableServices) {
        throw new Error(
          "Invio automatico vietato: il flusso include servizi con is_taxable = false.",
        );
      }

      const { data, error } = await deps.invokeEdgeFunction<{
        data: QuoteStatusEmailSendResponse;
      }>("quote_status_email_send", {
        method: "POST",
        body: request,
      });

      if (!data || error) {
        console.error("sendQuoteStatusEmail.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile inviare la mail cliente del preventivo",
          ),
        );
      }

      return data.data;
    },

    async getPaymentReminderContext(paymentId: Identifier) {
      const paymentResponse = await deps.baseDataProvider.getOne<Payment>(
        "payments",
        { id: paymentId },
      );
      const payment = paymentResponse.data;

      const [clientResponse, projectResponse] = await Promise.all([
        payment.client_id
          ? deps.baseDataProvider.getOne<Client>("clients", {
              id: payment.client_id,
            })
          : Promise.resolve({ data: null }),
        payment.project_id
          ? deps.baseDataProvider.getOne<Project>("projects", {
              id: payment.project_id,
            })
          : Promise.resolve({ data: null }),
      ]);

      return {
        payment,
        client: clientResponse.data,
        project: projectResponse.data,
      };
    },

    async sendPaymentReminder(
      request: PaymentReminderEmailSendRequest,
    ): Promise<PaymentReminderEmailSendResponse> {
      const { data, error } = await deps.invokeEdgeFunction<{
        data: PaymentReminderEmailSendResponse;
      }>("payment_reminder_send", {
        method: "POST",
        body: request,
      });

      if (!data || error) {
        console.error("sendPaymentReminder.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile inviare il reminder di pagamento",
          ),
        );
      }

      return data.data;
    },

    async executeWorkflowNotify(
      payload: WorkflowNotifyPayload,
    ): Promise<WorkflowNotifyResponse> {
      const { data, error } = await deps.invokeEdgeFunction<{
        data: WorkflowNotifyResponse;
      }>("workflow_notify", {
        method: "POST",
        body: payload,
      });

      if (!data || error) {
        console.error("executeWorkflowNotify.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile eseguire la notifica workflow",
          ),
        );
      }

      return data.data;
    },
  };
};

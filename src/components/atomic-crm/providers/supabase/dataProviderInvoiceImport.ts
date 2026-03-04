import type {
  Client,
  Contact,
  Project,
} from "../../types";
import type {
  GenerateInvoiceImportDraftRequest,
  InvoiceImportConfirmation,
  InvoiceImportDraft,
  InvoiceImportFileHandle,
  InvoiceImportWorkspace,
} from "@/lib/ai/invoiceImport";
import { buildInvoiceImportWorkspace } from "@/lib/ai/invoiceImportProvider";
import { extractEdgeFunctionErrorMessage } from "./edgeFunctionError";
import { uploadInvoiceImportFile } from "./storageBucket";
import { LARGE_PAGE, type BaseProvider, type InvokeEdgeFunction } from "./dataProviderTypes";

export const buildInvoiceImportProviderMethods = (deps: {
  baseDataProvider: BaseProvider;
  invokeEdgeFunction: InvokeEdgeFunction;
  getConfiguredInvoiceExtractionModel: () => Promise<string>;
}) => {
  const getInvoiceImportWorkspaceFromResources =
    async (): Promise<InvoiceImportWorkspace> => {
      const [clientsResponse, contactsResponse, projectsResponse] =
        await Promise.all([
          deps.baseDataProvider.getList<Client>("clients", {
            pagination: LARGE_PAGE,
            sort: { field: "name", order: "ASC" },
            filter: {},
          }),
          deps.baseDataProvider.getList<Contact>("contacts", {
            pagination: LARGE_PAGE,
            sort: { field: "updated_at", order: "DESC" },
            filter: {},
          }),
          deps.baseDataProvider.getList<Project>("projects", {
            pagination: LARGE_PAGE,
            sort: { field: "name", order: "ASC" },
            filter: {},
          }),
        ]);

      return buildInvoiceImportWorkspace({
        clients: clientsResponse.data.map((client) => ({
          id: client.id,
          name: client.name,
          email: client.email ?? null,
          billing_name: client.billing_name ?? null,
          vat_number: client.vat_number ?? null,
          fiscal_code: client.fiscal_code ?? null,
          billing_city: client.billing_city ?? null,
        })),
        contacts: contactsResponse.data.map((contact) => ({
          id: contact.id,
          client_id: contact.client_id ?? null,
          first_name: contact.first_name ?? null,
          last_name: contact.last_name ?? null,
        })),
        projects: projectsResponse.data.map((project) => ({
          id: project.id,
          name: project.name,
          client_id: project.client_id,
        })),
      });
    };

  return {
    async getInvoiceImportWorkspace(): Promise<InvoiceImportWorkspace> {
      return getInvoiceImportWorkspaceFromResources();
    },
    async uploadInvoiceImportFiles(
      files: File[],
    ): Promise<InvoiceImportFileHandle[]> {
      return Promise.all(files.map((file) => uploadInvoiceImportFile(file)));
    },
    async generateInvoiceImportDraft(
      request: Omit<GenerateInvoiceImportDraftRequest, "model">,
    ): Promise<InvoiceImportDraft> {
      const model = await deps.getConfiguredInvoiceExtractionModel();

      const { data, error } = await deps.invokeEdgeFunction<{
        data: InvoiceImportDraft;
      }>("invoice_import_extract", {
        method: "POST",
        body: {
          ...request,
          model,
        },
      });

      if (!data || error) {
        console.error("generateInvoiceImportDraft.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile estrarre i dati fattura nella chat AI",
          ),
        );
      }

      return data.data;
    },
    async confirmInvoiceImportDraft(
      draft: InvoiceImportDraft,
    ): Promise<InvoiceImportConfirmation> {
      const { data, error } = await deps.invokeEdgeFunction<{
        data: InvoiceImportConfirmation;
      }>("invoice_import_confirm", {
        method: "POST",
        body: {
          draft,
        },
      });

      if (!data || error) {
        console.error("confirmInvoiceImportDraft.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile confermare l'import fatture nel CRM.",
          ),
        );
      }

      return data.data;
    },
  };
};

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sql } from "https://esm.sh/kysely@0.27.2";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { db, CompiledQuery } from "../_shared/db.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  buildInvoiceImportConfirmNotes,
  getInvoiceImportConfirmPaymentDate,
  getInvoiceImportConfirmValidationErrors,
  validateInvoiceImportConfirmPayload,
  type InvoiceImportConfirmRecord,
  type InvoiceImportConfirmWorkspace,
} from "../_shared/invoiceImportConfirm.ts";
import { createErrorResponse } from "../_shared/utils.ts";

class InvoiceImportConfirmError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "InvoiceImportConfirmError";
    this.status = status;
  }
}

const getWorkspace = async (
  trx: any,
): Promise<InvoiceImportConfirmWorkspace> => {
  const [clients, projects] = await Promise.all([
    trx.selectFrom("clients").select(["id"]).execute(),
    trx.selectFrom("projects").select(["id", "client_id"]).execute(),
  ]);

  return { clients, projects };
};

const ensureRecordIsConfirmable = ({
  record,
  workspace,
}: {
  record: InvoiceImportConfirmRecord;
  workspace: InvoiceImportConfirmWorkspace;
}) => {
  const errors = getInvoiceImportConfirmValidationErrors(record, workspace);

  if (errors.length > 0) {
    throw new InvoiceImportConfirmError(
      400,
      `Il record ${record.invoiceRef ?? record.id} non e' confermabile: manca ${errors.join(", ")}.`,
    );
  }
};

const checkDuplicatePayment = async ({
  trx,
  record,
  paymentDate,
}: {
  trx: any;
  record: InvoiceImportConfirmRecord;
  paymentDate: string;
}): Promise<boolean> => {
  if (!record.invoiceRef || !record.clientId) {
    return false;
  }

  const existing = await trx
    .selectFrom("payments")
    .select(["id"])
    .where("client_id", "=", record.clientId)
    .where("payment_date", "=", paymentDate)
    .where("amount", "=", Number(record.amount))
    .where("status", "=", record.paymentStatus ?? "in_attesa")
    .where("payment_type", "=", record.paymentType ?? "saldo")
    .where(
      sql<boolean>`project_id is not distinct from ${record.projectId ?? null}`,
    )
    .where(sql<boolean>`invoice_ref is not distinct from ${record.invoiceRef}`)
    .executeTakeFirst();

  return !!existing;
};

const checkDuplicateExpense = async ({
  trx,
  record,
}: {
  trx: any;
  record: InvoiceImportConfirmRecord;
}): Promise<boolean> => {
  if (!record.invoiceRef) {
    return false;
  }

  const existing = await trx
    .selectFrom("expenses")
    .select(["id"])
    .where("expense_date", "=", record.documentDate!)
    .where("amount", "=", Number(record.amount))
    .where("expense_type", "=", record.expenseType ?? "acquisto_materiale")
    .where(
      sql<boolean>`client_id is not distinct from ${record.clientId ?? null}`,
    )
    .where(
      sql<boolean>`project_id is not distinct from ${record.projectId ?? null}`,
    )
    .where(sql<boolean>`invoice_ref is not distinct from ${record.invoiceRef}`)
    .executeTakeFirst();

  return !!existing;
};

/**
 * Resolve service fees: use explicit fees from the record when available,
 * otherwise fall back to splitting the total amount based on service type.
 */
const resolveServiceFees = (
  record: InvoiceImportConfirmRecord,
): { feeShooting: number; feeEditing: number; feeOther: number } => {
  const explicit = {
    feeShooting: record.feeShooting ?? 0,
    feeEditing: record.feeEditing ?? 0,
    feeOther: record.feeOther ?? 0,
  };
  const explicitTotal =
    explicit.feeShooting + explicit.feeEditing + explicit.feeOther;

  if (explicitTotal > 0) {
    return explicit;
  }

  // Fallback: split amount by service type
  const amount = Number(record.amount ?? 0);
  const serviceType = record.serviceType ?? "altro";

  switch (serviceType) {
    case "riprese":
      return { feeShooting: amount, feeEditing: 0, feeOther: 0 };
    case "montaggio":
      return { feeShooting: 0, feeEditing: amount, feeOther: 0 };
    case "riprese_montaggio":
      return {
        feeShooting: Math.round((amount / 2) * 100) / 100,
        feeEditing: Math.round((amount / 2) * 100) / 100,
        feeOther: 0,
      };
    default:
      return { feeShooting: 0, feeEditing: 0, feeOther: amount };
  }
};

const checkDuplicateService = async ({
  trx,
  record,
}: {
  trx: any;
  record: InvoiceImportConfirmRecord;
}): Promise<boolean> => {
  if (!record.documentDate) {
    return false;
  }

  const { feeShooting, feeEditing, feeOther } = resolveServiceFees(record);

  const existing = await trx
    .selectFrom("services")
    .select(["id"])
    .where("service_date", "=", record.documentDate)
    .where("service_type", "=", record.serviceType ?? "altro")
    .where("fee_shooting", "=", feeShooting)
    .where("fee_editing", "=", feeEditing)
    .where("fee_other", "=", feeOther)
    .where(
      sql<boolean>`description is not distinct from ${record.description ?? null}`,
    )
    .where(
      sql<boolean>`project_id is not distinct from ${record.projectId ?? null}`,
    )
    .where(
      sql<boolean>`client_id is not distinct from ${record.clientId ?? null}`,
    )
    .executeTakeFirst();

  return !!existing;
};

const confirmInvoiceImportDraft = async ({
  req,
  userId,
  currentUserSale,
}: {
  req: Request;
  userId: string;
  currentUserSale: unknown;
}) => {
  if (!currentUserSale) {
    return createErrorResponse(401, "Unauthorized");
  }

  const payloadResult = validateInvoiceImportConfirmPayload(await req.json());
  if (payloadResult.error || !payloadResult.data) {
    return createErrorResponse(
      400,
      payloadResult.error ?? "Payload non valido",
    );
  }

  try {
    const result = await db.transaction().execute(async (trx) => {
      await trx.executeQuery(CompiledQuery.raw("SET LOCAL ROLE authenticated"));
      await trx.executeQuery(
        CompiledQuery.raw(
          `SELECT set_config('request.jwt.claim.sub', '${userId}', true)`,
        ),
      );

      const workspace = await getWorkspace(trx);

      type CreatedRecord = {
        resource: "payments" | "expenses" | "services";
        id: string;
        invoiceRef?: string | null;
        amount?: number | null;
      };
      type SkippedRecord = {
        resource: "payments" | "expenses" | "services";
        reason: string;
        description?: string | null;
        amount?: number | null;
      };

      const created: CreatedRecord[] = [];
      const skipped: SkippedRecord[] = [];

      for (const record of payloadResult.data.draft.records) {
        ensureRecordIsConfirmable({ record, workspace });

        if (record.resource === "payments") {
          const paymentDate = getInvoiceImportConfirmPaymentDate(record);

          if (!paymentDate) {
            throw new InvoiceImportConfirmError(
              400,
              `Il record ${record.invoiceRef ?? record.id} non ha una data pagamento valida.`,
            );
          }

          const isDuplicate = await checkDuplicatePayment({
            trx,
            record,
            paymentDate,
          });

          if (isDuplicate) {
            skipped.push({
              resource: "payments",
              reason: `Pagamento gia presente per ${record.invoiceRef ?? paymentDate}`,
              description: record.description,
              amount: record.amount,
            });
            continue;
          }

          const insertedPayment = await trx
            .insertInto("payments")
            .values({
              client_id: record.clientId!,
              project_id: record.projectId ?? null,
              quote_id: null,
              payment_date: paymentDate,
              payment_type: record.paymentType ?? "saldo",
              amount: Number(record.amount),
              method: record.paymentMethod ?? null,
              invoice_ref: record.invoiceRef ?? null,
              status: record.paymentStatus ?? "in_attesa",
              notes:
                buildInvoiceImportConfirmNotes({
                  record,
                  model: payloadResult.data.draft.model,
                }) || null,
            })
            .returning(["id"])
            .executeTakeFirstOrThrow();

          created.push({
            resource: "payments",
            id: insertedPayment.id,
            invoiceRef: record.invoiceRef ?? null,
            amount: record.amount,
          });
          continue;
        }

        if (record.resource === "services") {
          const isDuplicate = await checkDuplicateService({ trx, record });

          if (isDuplicate) {
            skipped.push({
              resource: "services",
              reason: `Servizio gia presente per ${record.documentDate}`,
              description: record.description,
              amount: record.amount,
            });
            continue;
          }

          const { feeShooting, feeEditing, feeOther } =
            resolveServiceFees(record);

          const insertedService = await trx
            .insertInto("services")
            .values({
              client_id: record.clientId ?? null,
              project_id: record.projectId ?? null,
              service_date: record.documentDate!,
              service_end: record.serviceEnd ?? null,
              all_day: record.allDay ?? true,
              is_taxable: record.isTaxable ?? true,
              service_type: record.serviceType ?? "altro",
              description: record.description ?? null,
              fee_shooting: feeShooting,
              fee_editing: feeEditing,
              fee_other: feeOther,
              discount: record.discount ?? 0,
              km_distance: record.kmDistance ?? 0,
              km_rate: record.kmRate ?? 0,
              location: record.location ?? null,
              invoice_ref: record.invoiceRef ?? null,
              notes:
                buildInvoiceImportConfirmNotes({
                  record,
                  model: payloadResult.data.draft.model,
                }) || null,
            })
            .returning(["id"])
            .executeTakeFirstOrThrow();

          created.push({
            resource: "services",
            id: insertedService.id,
            invoiceRef: record.invoiceRef ?? null,
            amount: record.amount,
          });
          continue;
        }

        const isDuplicate = await checkDuplicateExpense({ trx, record });

        if (isDuplicate) {
          skipped.push({
            resource: "expenses",
            reason: `Spesa gia presente per ${record.invoiceRef ?? record.documentDate}`,
            description: record.description,
            amount: record.amount,
          });
          continue;
        }

        const insertedExpense = await trx
          .insertInto("expenses")
          .values({
            client_id: record.clientId ?? null,
            project_id: record.projectId ?? null,
            expense_date: record.documentDate!,
            expense_type: record.expenseType ?? "acquisto_materiale",
            amount: Number(record.amount),
            invoice_ref: record.invoiceRef ?? null,
            description:
              record.description ??
              record.counterpartyName ??
              buildInvoiceImportConfirmNotes({
                record,
                model: payloadResult.data.draft.model,
              }) ??
              null,
          })
          .returning(["id"])
          .executeTakeFirstOrThrow();

        created.push({
          resource: "expenses",
          id: insertedExpense.id,
          invoiceRef: record.invoiceRef ?? null,
          amount: record.amount,
        });
      }

      return { created, skipped };
    });

    return new Response(JSON.stringify({ data: result }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("invoice_import_confirm.error", error);

    if (error instanceof InvoiceImportConfirmError) {
      return createErrorResponse(error.status, error.message);
    }

    return createErrorResponse(
      500,
      "Impossibile confermare l'import fatture nel CRM",
    );
  }
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (request) =>
    AuthMiddleware(request, async (authedRequest) =>
      UserMiddleware(authedRequest, async (_, user) => {
        const currentUserSale = user ? await getUserSale(user) : null;
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (authedRequest.method === "POST") {
          return confirmInvoiceImportDraft({
            req: authedRequest,
            userId: user.id,
            currentUserSale,
          });
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);

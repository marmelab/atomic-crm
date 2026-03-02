import { required, minValue, useGetList, useGetOne } from "ra-core";
import { useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";

import type { Project, Quote } from "../types";
import { quoteStatusLabels } from "../quotes/quotesTypes";
import {
  paymentTypeChoices,
  paymentTypeDescriptions,
  paymentMethodChoices,
  paymentTypeLabels,
  paymentStatusChoices,
} from "./paymentTypes";
import {
  buildQuoteSearchFilter,
  getPaymentCreateDraftContextFromSearch,
  isPaymentDraftContextStillApplicable,
  buildPaymentPatchFromQuote,
  getSuggestedPaymentAmountFromQuote,
  shouldAutoApplySuggestedPaymentAmount,
  shouldClearProjectForClient,
  shouldClearQuoteForClient,
} from "./paymentLinking";
import { toOptionalIdentifier } from "../quotes/quoteProjectLinking";
import { buildNameSearchFilter } from "../misc/referenceSearch";
import { buildQuotePaymentsSummary } from "../quotes/quotePaymentsSummary";
import type { Payment } from "../types";

export const PaymentInputs = () => (
  <div className="flex flex-col gap-2 p-1">
    <div className="flex gap-6 flex-col md:flex-row">
      <div className="flex flex-col gap-10 flex-1">
        <PaymentIdentityInputs />
      </div>
      <Separator
        orientation="vertical"
        className="flex-shrink-0 hidden md:block"
      />
      <div className="flex flex-col gap-10 flex-1">
        <PaymentDetailInputs />
      </div>
    </div>
  </div>
);

const PaymentIdentityInputs = () => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Pagamento</h6>
    <DateInput
      source="payment_date"
      label="Data pagamento"
      validate={required()}
      helperText={false}
    />
    <LinkedQuoteInput />
    <ReferenceInput source="client_id" reference="clients">
      <AutocompleteInput
        label="Cliente"
        optionText="name"
        validate={required()}
        helperText={false}
        filterToQuery={buildNameSearchFilter}
      />
    </ReferenceInput>
    <LinkedProjectInput />
  </div>
);

const LinkedQuoteInput = () => {
  const clientId = useWatch({ name: "client_id" });
  const quoteId = useWatch({ name: "quote_id" });
  const projectId = useWatch({ name: "project_id" });
  const { setValue } = useFormContext();
  const { data: selectedQuote } = useGetOne<Quote>(
    "quotes",
    {
      id: quoteId,
    },
    {
      enabled: !!quoteId,
    },
  );

  useEffect(() => {
    if (!selectedQuote) return;

    const patch = buildPaymentPatchFromQuote({
      quote: selectedQuote,
      currentClientId: clientId,
      currentProjectId: projectId,
    });

    if (patch.client_id != null) {
      setValue("client_id", patch.client_id, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (patch.project_id != null) {
      setValue("project_id", patch.project_id, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [clientId, projectId, selectedQuote, setValue]);

  useEffect(() => {
    if (
      shouldClearQuoteForClient({
        quote: selectedQuote,
        clientId,
      })
    ) {
      setValue("quote_id", null, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [clientId, selectedQuote, setValue]);

  return (
    <ReferenceInput
      source="quote_id"
      reference="quotes"
      filter={clientId ? { "client_id@eq": String(clientId) } : undefined}
    >
      <AutocompleteInput
        label="Preventivo collegato"
        helperText={false}
        placeholder="Seleziona un preventivo"
        parse={toOptionalIdentifier}
        filterToQuery={buildQuoteSearchFilter}
        optionText={(quote?: Quote) => {
          if (!quote) return "Preventivo";
          const description = quote.description?.trim() || "Preventivo";
          const status = quoteStatusLabels[quote.status] ?? quote.status;
          const amount = Number(quote.amount || 0).toLocaleString("it-IT", {
            style: "currency",
            currency: "EUR",
          });
          return `${description} · ${status} · ${amount}`;
        }}
      />
    </ReferenceInput>
  );
};

const LinkedProjectInput = () => {
  const clientId = useWatch({ name: "client_id" });
  const projectId = useWatch({ name: "project_id" });
  const { setValue } = useFormContext();
  const { data: selectedProject } = useGetOne<Project>(
    "projects",
    {
      id: projectId,
    },
    {
      enabled: !!projectId,
    },
  );

  useEffect(() => {
    if (
      shouldClearProjectForClient({
        project: selectedProject,
        clientId,
      })
    ) {
      setValue("project_id", null, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [clientId, selectedProject, setValue]);

  return (
    <ReferenceInput
      source="project_id"
      reference="projects"
      filter={clientId ? { "client_id@eq": String(clientId) } : undefined}
    >
      <AutocompleteInput
        label="Progetto"
        optionText="name"
        helperText={false}
        placeholder="Seleziona un progetto"
        parse={toOptionalIdentifier}
      />
    </ReferenceInput>
  );
};

const PaymentDetailInputs = () => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Dettagli</h6>
    <SelectInput
      source="payment_type"
      label="Tipo"
      choices={paymentTypeChoices}
      optionText={(choice: { id: string; name: string }) => (
        <span title={paymentTypeDescriptions[choice.id]}>{choice.name}</span>
      )}
      validate={required()}
      helperText={false}
    />
    <NumberInput
      source="amount"
      label="Importo (EUR)"
      validate={[required(), minValue(0)]}
      helperText={false}
    />
    <QuotePaymentSuggestionCard />
    <SelectInput
      source="method"
      label="Metodo pagamento"
      choices={paymentMethodChoices}
      helperText={false}
    />
    <TextInput source="invoice_ref" label="Rif. Fattura" helperText={false} />
    <SelectInput
      source="status"
      label="Stato"
      choices={paymentStatusChoices}
      defaultValue="in_attesa"
      helperText={false}
    />
    <TextInput source="notes" label="Note" multiline helperText={false} />
  </div>
);

const formatCurrency = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const QuotePaymentSuggestionCard = () => {
  const location = useLocation();
  const quoteId = useWatch({ name: "quote_id" });
  const paymentType = useWatch({ name: "payment_type" }) as
    | Payment["payment_type"]
    | undefined;
  const amount = useWatch({ name: "amount" });
  const { control, setValue } = useFormContext();
  const { dirtyFields } = useFormState({
    control,
    name: "amount",
  });
  const draftContext = useMemo(
    () => getPaymentCreateDraftContextFromSearch(location.search),
    [location.search],
  );
  const activeDraftContext = useMemo(
    () =>
      isPaymentDraftContextStillApplicable({
        draftContext,
        quoteId,
      })
        ? draftContext
        : null,
    [draftContext, quoteId],
  );
  const isDraftContextOutOfScope =
    Boolean(draftContext?.quoteId) && Boolean(quoteId) && !activeDraftContext;

  const { data: quote } = useGetOne<Quote>(
    "quotes",
    {
      id: quoteId,
    },
    {
      enabled: !!quoteId,
    },
  );
  const { data: linkedPayments, isPending } = useGetList<Payment>(
    "payments",
    {
      filter: { "quote_id@eq": String(quoteId) },
      sort: { field: "payment_date", order: "DESC" },
      pagination: { page: 1, perPage: 100 },
    },
    {
      enabled: !!quoteId,
    },
  );

  const suggestedAmount =
    quote && linkedPayments
      ? getSuggestedPaymentAmountFromQuote({
          quoteAmount: quote.amount,
          payments: linkedPayments,
          paymentType,
        })
      : null;
  const summary =
    quote && linkedPayments
      ? buildQuotePaymentsSummary({
          quoteAmount: quote.amount,
          payments: linkedPayments,
        })
      : null;
  const numericAmount =
    typeof amount === "number" ? amount : Number(amount ?? 0);
  const isDraftAmountPreserved =
    activeDraftContext?.amount != null &&
    !dirtyFields.amount &&
    Number.isFinite(numericAmount) &&
    numericAmount === activeDraftContext.amount;

  useEffect(() => {
    if (
      !quoteId ||
      !shouldAutoApplySuggestedPaymentAmount({
        currentAmount: amount,
        suggestedAmount,
        isAmountDirty: Boolean(dirtyFields.amount),
        draftAmount: activeDraftContext?.amount ?? null,
      })
    ) {
      return;
    }

    setValue("amount", suggestedAmount, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
  }, [
    activeDraftContext?.amount,
    amount,
    dirtyFields.amount,
    quoteId,
    setValue,
    suggestedAmount,
  ]);

  if (!quoteId || !quote) {
    return null;
  }

  if (isPending || !summary) {
    return (
      <div className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
        Sto leggendo il riepilogo pagamenti del preventivo collegato...
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-3 text-sm space-y-3">
      <div className="space-y-1">
        <p className="font-medium">Contesto preventivo collegato</p>
        <p className="text-xs text-muted-foreground">
          Importo preventivo {formatCurrency(quote.amount)} · gia collegato{" "}
          {formatCurrency(summary.linkedTotal)} · residuo{" "}
          {formatCurrency(summary.remainingAmount)}
        </p>
        {activeDraftContext?.amount != null ? (
          <p className="text-xs text-muted-foreground">
            Importo arrivato dalla bozza AI{" "}
            {formatCurrency(activeDraftContext.amount)}
            {activeDraftContext.amount !== summary.remainingAmount
              ? ` · residuo locale ${formatCurrency(summary.remainingAmount)}`
              : ""}
            {isDraftAmountPreserved
              ? " · il form mantiene la bozza finche non scegli tu un altro valore."
              : " · stai lavorando su un valore diverso dalla bozza iniziale."}
          </p>
        ) : null}
        {isDraftContextOutOfScope ? (
          <p className="text-xs text-amber-700">
            La bozza AI iniziale era riferita a un altro preventivo. Da qui in
            poi valgono solo il contesto e i suggerimenti locali del preventivo
            attualmente selezionato.
          </p>
        ) : null}
      </div>

      {suggestedAmount != null ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Suggerimento per{" "}
              {paymentType
                ? (paymentTypeLabels[paymentType] ?? paymentType)
                : "questo pagamento"}
              : usa il residuo non ancora collegato al preventivo.
            </p>
            <p className="text-xs text-muted-foreground">
              Dopo il primo edit manuale dell'importo, il form non lo ricalcola
              piu da solo.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setValue("amount", suggestedAmount, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })
            }
          >
            Usa {formatCurrency(suggestedAmount)}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nessun importo suggerito automatico per questo tipo pagamento.
        </p>
      )}
    </div>
  );
};

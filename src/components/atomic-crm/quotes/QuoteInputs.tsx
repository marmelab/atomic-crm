import { required, minValue, useGetOne } from "ra-core";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ArrayInput } from "@/components/admin/array-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { SelectInput } from "@/components/admin/select-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { Separator } from "@/components/ui/separator";

import { buildNameSearchFilter } from "../misc/referenceSearch";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Project, QuoteItem } from "../types";
import { computeQuoteItemsTotal, hasQuoteItems } from "./quoteItems";
import { quoteStatuses } from "./quotesTypes";
import { toOptionalIdentifier } from "./quoteProjectLinking";

const toIdString = (value: unknown) =>
  value == null || value === "" ? null : String(value);

export const QuoteInputs = () => {
  const status = useWatch({ name: "status" });
  const clientId = useWatch({ name: "client_id" });
  const projectId = useWatch({ name: "project_id" });
  const amount = useWatch({ name: "amount" });
  const recordId = toIdString(useWatch({ name: "id" }));
  const currentTaxable = useWatch({ name: "is_taxable" });
  const quoteItems = useWatch({ name: "quote_items" }) as
    | QuoteItem[]
    | undefined;
  const allDay = useWatch({ name: "all_day" }) ?? true;
  const { setValue, getFieldState } = useFormContext();
  const { quoteServiceTypes, fiscalConfig } = useConfigurationContext();
  const { data: selectedProject } = useGetOne<Project>(
    "projects",
    {
      id: projectId,
    },
    {
      enabled: !!projectId,
    },
  );

  const DateComponent = allDay ? DateInput : DateTimeInput;
  const itemizedQuote = hasQuoteItems(quoteItems);
  const itemizedAmount = computeQuoteItemsTotal(quoteItems);
  const selectedClientId = toIdString(clientId);
  const taxabilityDefaults = fiscalConfig?.taxabilityDefaults;
  const suggestedTaxable =
    selectedProject &&
    taxabilityDefaults?.nonTaxableCategories?.includes(selectedProject.category)
      ? false
      : selectedClientId &&
          taxabilityDefaults?.nonTaxableClientIds?.includes(selectedClientId)
        ? false
        : true;

  useEffect(() => {
    if (!selectedProject) return;
    if (String(clientId ?? "") === String(selectedProject.client_id ?? "")) {
      return;
    }
    setValue("client_id", selectedProject.client_id, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [clientId, selectedProject, setValue]);

  useEffect(() => {
    if (!itemizedQuote) return;
    if (Number(amount ?? 0) === itemizedAmount) return;

    setValue("amount", itemizedAmount, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [amount, itemizedAmount, itemizedQuote, setValue]);

  useEffect(() => {
    if (recordId) {
      return;
    }

    // Use formState directly from getFieldState to avoid dependency cycles
    // formState object changes reference on every render
    const isDirty = getFieldState("is_taxable").isDirty;
    if (isDirty || currentTaxable === suggestedTaxable) {
      return;
    }

    setValue("is_taxable", suggestedTaxable, {
      shouldDirty: false,
      shouldValidate: false,
      shouldTouch: false,
    });
  }, [
    currentTaxable,
    recordId,
    setValue,
    suggestedTaxable,
    // Intentionally NOT depending on formState/getFieldState to avoid cycles
  ]);

  return (
    <div className="flex flex-col gap-4">
      <ReferenceInput source="client_id" reference="clients">
        <AutocompleteInput
          label="Cliente"
          optionText="name"
          validate={required()}
          helperText={false}
          filterToQuery={buildNameSearchFilter}
        />
      </ReferenceInput>

      <ReferenceInput
        source="project_id"
        reference="projects"
        filter={clientId ? { "client_id@eq": String(clientId) } : undefined}
      >
        <AutocompleteInput
          label="Progetto collegato"
          optionText="name"
          helperText={false}
          placeholder="Nessun progetto collegato"
          parse={toOptionalIdentifier}
          filterToQuery={buildNameSearchFilter}
        />
      </ReferenceInput>

      <SelectInput
        source="service_type"
        label="Tipo servizio"
        choices={quoteServiceTypes}
        optionText="label"
        optionValue="value"
        validate={required()}
        helperText={false}
      />

      <BooleanInput
        source="all_day"
        label="Tutto il giorno"
        defaultValue={true}
      />
      <DateComponent
        source="event_start"
        label="Data inizio evento"
        helperText={false}
      />
      <DateComponent
        source="event_end"
        label="Data fine evento"
        validate={(value: string, allValues: Record<string, unknown>) => {
          if (
            value &&
            allValues.event_start &&
            value < (allValues.event_start as string)
          ) {
            return "La data fine non può essere prima della data inizio";
          }
        }}
        helperText={false}
      />

      <TextInput
        source="description"
        label="Descrizione breve"
        multiline
        rows={3}
        helperText="Titolo o riepilogo breve del preventivo."
      />

      <ArrayInput
        source="quote_items"
        label="Voci preventivo"
        helperText="Opzionale. Se aggiungi voci, l'importo totale si calcola da solo."
      >
        <SimpleFormIterator
          disableReordering
          getItemLabel={(index) => `Voce ${index + 1}`}
        >
          <TextInput
            source="description"
            label="Voce"
            validate={required()}
            helperText={false}
          />
          <NumberInput
            source="quantity"
            label="Quantità"
            defaultValue={1}
            validate={[required(), minValue(1)]}
            helperText={false}
          />
          <NumberInput
            source="unit_price"
            label="Prezzo unitario (EUR)"
            defaultValue={0}
            validate={[required(), minValue(0)]}
            helperText={false}
          />
        </SimpleFormIterator>
      </ArrayInput>

      <NumberInput
        source="amount"
        label="Importo preventivo (EUR)"
        validate={[required(), minValue(0)]}
        defaultValue={0}
        disabled={itemizedQuote}
        helperText={
          itemizedQuote
            ? "Calcolato automaticamente dalle voci del preventivo."
            : false
        }
      />

      <BooleanInput
        source="is_taxable"
        label="Tassabile"
        defaultValue={suggestedTaxable}
        helperText="Disattiva solo se il lavoro non deve contribuire alla base fiscale."
      />

      <Separator />

      <SelectInput
        source="status"
        label="Stato"
        choices={quoteStatuses}
        optionText="label"
        optionValue="value"
        defaultValue="primo_contatto"
        validate={required()}
        helperText={false}
      />

      <DateInput
        source="sent_date"
        label="Data invio preventivo"
        validate={(value: string, allValues: Record<string, unknown>) => {
          if (
            !value &&
            allValues.status &&
            allValues.status !== "primo_contatto"
          ) {
            return "Obbligatoria per questo stato";
          }
        }}
        helperText={false}
      />

      <DateInput
        source="response_date"
        label="Data risposta"
        validate={(value: string, allValues: Record<string, unknown>) => {
          const needsResponse = [
            "accettato",
            "acconto_ricevuto",
            "in_lavorazione",
            "completato",
            "saldato",
            "rifiutato",
          ];
          if (!value && needsResponse.includes(allValues.status as string)) {
            return "Obbligatoria per questo stato";
          }
          if (
            value &&
            allValues.sent_date &&
            value < (allValues.sent_date as string)
          ) {
            return "La data risposta non può essere prima della data invio";
          }
        }}
        helperText={false}
      />

      {status === "rifiutato" && (
        <TextInput
          source="rejection_reason"
          label="Motivo rifiuto"
          validate={required()}
          multiline
          rows={2}
          helperText={false}
        />
      )}

      <TextInput
        source="notes"
        label="Note"
        multiline
        rows={2}
        helperText={false}
      />
    </div>
  );
};

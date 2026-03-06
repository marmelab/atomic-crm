import { memo } from "react";
import { required } from "ra-core";
import { useWatch } from "react-hook-form";
import { SelectInput } from "@/components/admin/select-input";
import { DateInput } from "@/components/admin/date-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { TextInput } from "@/components/admin/text-input";
import { Activity } from "lucide-react";

import { quoteStatuses } from "../quotesTypes";

export const QuoteStatusInputs = memo(function QuoteStatusInputs({
  suggestedTaxable,
}: {
  suggestedTaxable: boolean;
}) {
  const status = useWatch({ name: "status" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-4 w-4 text-amber-500" />
        <h6 className="text-sm font-semibold text-amber-700">
          Stato e fiscalità
        </h6>
      </div>

      <BooleanInput
        source="is_taxable"
        label="Tassabile"
        defaultValue={suggestedTaxable}
        helperText="Disattiva solo se il lavoro non deve contribuire alla base fiscale."
      />

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
    </div>
  );
});

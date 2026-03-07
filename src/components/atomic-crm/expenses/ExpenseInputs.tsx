import { required, minValue, useGetOne } from "ra-core";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { SelectInput } from "@/components/admin/select-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { calculateKmReimbursement } from "@/lib/semantics/crmSemanticRegistry";

import { expenseTypeChoices, expenseTypeDescriptions } from "./expenseTypes";
import { buildNameSearchFilter } from "../misc/referenceSearch";
import { TravelRouteCalculatorDialog } from "../travel/TravelRouteCalculatorDialog";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { CloudinaryUploadInput } from "../cloudinary/CloudinaryUploadInput";

export const ExpenseInputs = () => {
  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex gap-6 flex-col md:flex-row">
        <div className="flex flex-col gap-10 flex-1">
          <ExpenseIdentityInputs />
        </div>
        <Separator
          orientation="vertical"
          className="flex-shrink-0 hidden md:block"
        />
        <div className="flex flex-col gap-10 flex-1">
          <ExpenseAmountInputs />
        </div>
      </div>
    </div>
  );
};

const ExpenseIdentityInputs = () => {
  const supplierId = useWatch({ name: "supplier_id" });
  const { setValue, getValues } = useFormContext();

  const { data: supplier } = useGetOne(
    "suppliers",
    { id: supplierId },
    { enabled: !!supplierId },
  );

  useEffect(() => {
    if (!supplier?.default_expense_type) return;
    const current = getValues("expense_type");
    if (!current) {
      setValue("expense_type", supplier.default_expense_type, {
        shouldDirty: true,
      });
    }
  }, [supplier, setValue, getValues]);

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Spesa</h6>
      <DateInput
        source="expense_date"
        label="Data"
        validate={required()}
        helperText={false}
      />
      <SelectInput
        source="expense_type"
        label="Tipo"
        choices={expenseTypeChoices}
        optionText={(choice: { id: string; name: string }) => (
          <span title={expenseTypeDescriptions[choice.id]}>{choice.name}</span>
        )}
        validate={required()}
        helperText={false}
      />
      <ReferenceInput source="project_id" reference="projects">
        <AutocompleteInput
          label="Progetto"
          optionText="name"
          helperText={false}
          filterToQuery={buildNameSearchFilter}
        />
      </ReferenceInput>
      <ReferenceInput source="client_id" reference="clients">
        <AutocompleteInput
          label="Cliente"
          optionText="name"
          helperText={false}
          filterToQuery={buildNameSearchFilter}
        />
      </ReferenceInput>
      <ReferenceInput source="supplier_id" reference="suppliers">
        <AutocompleteInput
          label="Fornitore"
          optionText="name"
          helperText={false}
          filterToQuery={buildNameSearchFilter}
        />
      </ReferenceInput>
    </div>
  );
};

const ExpenseAmountInputs = () => {
  const expenseType = useWatch({ name: "expense_type" });
  const isKm = expenseType === "spostamento_km";
  const isCredit = expenseType === "credito_ricevuto";

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {isCredit ? "Credito" : "Importo"}
      </h6>
      {isCredit ? <CreditSection /> : isKm ? <KmSection /> : <AmountSection />}
      <TextInput source="description" label="Descrizione" helperText={false} />
      <TextInput source="invoice_ref" label="Rif. Fattura" helperText={false} />
      <CloudinaryUploadInput
        source="proof_url"
        label="Ricevuta / Documento"
        folder="crm/expenses"
        mode="proof"
      />
    </div>
  );
};

const CreditSection = () => (
  <>
    <NumberInput
      source="amount"
      label="Valore credito (EUR)"
      defaultValue={0}
      validate={[required(), minValue(0)]}
      helperText="Es: iPhone dato come compenso, sconto concordato"
    />
  </>
);

const KmSection = () => {
  const { operationalConfig } = useConfigurationContext();
  const { getValues, setValue } = useFormContext();
  const defaultKmRate = operationalConfig.defaultKmRate;
  const kmDistance = useWatch({ name: "km_distance" }) ?? 0;
  const kmRate = useWatch({ name: "km_rate" }) ?? defaultKmRate;
  const total = calculateKmReimbursement({
    kmDistance,
    kmRate,
    defaultKmRate,
  });

  return (
    <>
      <div className="flex justify-end">
        <TravelRouteCalculatorDialog
          defaultKmRate={defaultKmRate}
          defaultTravelOrigin={operationalConfig.defaultTravelOrigin}
          currentKmRate={kmRate}
          onApply={(estimate) => {
            setValue("km_distance", estimate.totalDistanceKm, {
              shouldDirty: true,
            });
            setValue("km_rate", estimate.kmRate ?? defaultKmRate, {
              shouldDirty: true,
            });

            const currentDescription = getValues("description");
            if (
              typeof currentDescription !== "string" ||
              currentDescription.trim() === "" ||
              currentDescription.startsWith("Spostamento —")
            ) {
              setValue("description", estimate.generatedDescription, {
                shouldDirty: true,
              });
            }
          }}
        />
      </div>
      <NumberInput
        source="km_distance"
        label="Km percorsi"
        defaultValue={0}
        validate={minValue(0)}
        helperText={false}
      />
      <NumberInput
        source="km_rate"
        label="Tariffa km (EUR)"
        defaultValue={defaultKmRate}
        validate={minValue(0)}
        helperText={`Tariffa predefinita condivisa: EUR ${defaultKmRate.toLocaleString(
          "it-IT",
          { minimumFractionDigits: 2 },
        )}`}
      />
      <div className="text-sm font-medium px-1 pt-1 border-t">
        Totale:{" "}
        <span className="font-bold">
          EUR {total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </>
  );
};

const AmountSection = () => {
  const amount = useWatch({ name: "amount" }) ?? 0;
  const markup = useWatch({ name: "markup_percent" }) ?? 0;
  const total = Number(amount) * (1 + Number(markup) / 100);

  return (
    <>
      <NumberInput
        source="amount"
        label="Importo spesa (EUR)"
        defaultValue={0}
        validate={minValue(0)}
        helperText={false}
      />
      <NumberInput
        source="markup_percent"
        label="Ricarico %"
        defaultValue={0}
        validate={minValue(0)}
        helperText={false}
      />
      <div className="text-sm font-medium px-1 pt-1 border-t">
        Totale:{" "}
        <span className="font-bold">
          EUR {total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </>
  );
};

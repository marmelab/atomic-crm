import { minValue, required, useGetOne } from "ra-core";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { SelectInput } from "@/components/admin/select-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { calculateKmReimbursement } from "@/lib/semantics/crmSemanticRegistry";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { buildNameSearchFilter } from "../misc/referenceSearch";
import { TravelRouteCalculatorDialog } from "../travel/TravelRouteCalculatorDialog";
import type { Project } from "../types";
import { ServiceTotals } from "./ServiceTotals";

const toIdString = (value: unknown) =>
  value == null || value === "" ? null : String(value);

const getSuggestedServiceTaxable = ({
  projectCategory,
  clientId,
  defaults,
}: {
  projectCategory?: string | null;
  clientId?: string | null;
  defaults?: {
    nonTaxableCategories?: string[];
    nonTaxableClientIds?: string[];
  };
}) => {
  if (
    projectCategory &&
    defaults?.nonTaxableCategories?.includes(projectCategory)
  ) {
    return false;
  }

  if (clientId && defaults?.nonTaxableClientIds?.includes(clientId)) {
    return false;
  }

  return true;
};

export const ServiceInputs = () => {
  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex gap-6 flex-col md:flex-row">
        <div className="flex flex-col gap-10 flex-1">
          <ServiceIdentityInputs />
          <ServiceFeeInputs />
        </div>
        <Separator
          orientation="vertical"
          className="flex-shrink-0 hidden md:block"
        />
        <div className="flex flex-col gap-10 flex-1">
          <ServiceKmInputs />
          <ServiceExtraInputs />
        </div>
      </div>
    </div>
  );
};

const ServiceIdentityInputs = () => {
  const { serviceTypeChoices } = useConfigurationContext();
  const allDay = useWatch({ name: "all_day" }) ?? true;
  const DateComponent = allDay ? DateInput : DateTimeInput;

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Servizio</h6>
      <BooleanInput
        source="all_day"
        label="Tutto il giorno"
        defaultValue={true}
      />
      <DateComponent
        source="service_date"
        label="Data inizio"
        validate={required()}
        helperText={false}
      />
      <DateComponent
        source="service_end"
        label="Data fine"
        validate={(value: string, allValues: Record<string, unknown>) => {
          if (
            value &&
            allValues.service_date &&
            value < (allValues.service_date as string)
          ) {
            return "La data fine non può essere prima della data inizio";
          }
        }}
        helperText={false}
      />
      <ReferenceInput source="client_id" reference="clients">
        <AutocompleteInput
          label="Cliente"
          optionText="name"
          helperText={false}
          filterToQuery={buildNameSearchFilter}
        />
      </ReferenceInput>
      <ReferenceInput source="project_id" reference="projects">
        <AutocompleteInput
          label="Progetto"
          optionText="name"
          helperText={false}
          filterToQuery={buildNameSearchFilter}
        />
      </ReferenceInput>
      <SelectInput
        source="service_type"
        label="Tipo servizio"
        choices={serviceTypeChoices}
        optionText="label"
        optionValue="value"
        validate={required()}
        helperText={false}
      />
    </div>
  );
};

const ServiceFeeInputs = () => {
  const { fiscalConfig } = useConfigurationContext();
  const { setValue, getFieldState } = useFormContext();
  const projectId = toIdString(useWatch({ name: "project_id" }));
  const clientId = toIdString(useWatch({ name: "client_id" }));
  const recordId = toIdString(useWatch({ name: "id" }));
  const currentIsTaxable = useWatch({ name: "is_taxable" });

  const { data: selectedProject } = useGetOne<Project>(
    "projects",
    { id: projectId ?? undefined },
    { enabled: !!projectId },
  );

  const suggestedTaxable = getSuggestedServiceTaxable({
    projectCategory: selectedProject?.category,
    clientId,
    defaults: fiscalConfig?.taxabilityDefaults,
  });

  useEffect(() => {
    if (recordId) {
      return;
    }

    // Use formState directly from getFieldState to avoid dependency cycles
    // formState object changes reference on every render
    const isDirty = getFieldState("is_taxable").isDirty;
    if (isDirty || currentIsTaxable === suggestedTaxable) {
      return;
    }

    setValue("is_taxable", suggestedTaxable, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [
    currentIsTaxable,
    recordId,
    setValue,
    suggestedTaxable,
    // Intentionally NOT depending on formState/getFieldState to avoid cycles
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Compensi</h6>
      <NumberInput
        source="fee_shooting"
        label="Compenso riprese (EUR)"
        defaultValue={0}
        validate={minValue(0)}
        helperText={false}
      />
      <NumberInput
        source="fee_editing"
        label="Compenso montaggio (EUR)"
        defaultValue={0}
        validate={minValue(0)}
        helperText={false}
      />
      <NumberInput
        source="fee_other"
        label="Compenso altro (EUR)"
        defaultValue={0}
        validate={minValue(0)}
        helperText={false}
      />
      <NumberInput
        source="discount"
        label="Sconto (EUR)"
        defaultValue={0}
        validate={minValue(0)}
        helperText={false}
      />
      <BooleanInput
        source="is_taxable"
        label="Tassabile"
        defaultValue={suggestedTaxable}
        helperText="Togli la spunta se gli incassi per questo servizio non devono entrare nella base fiscale."
      />
      <ServiceTotals />
    </div>
  );
};

const ServiceKmInputs = () => {
  const { operationalConfig } = useConfigurationContext();
  const { getValues, setValue } = useFormContext();
  const defaultKmRate = operationalConfig.defaultKmRate;
  const kmDistance = useWatch({ name: "km_distance" }) ?? 0;
  const kmRate = useWatch({ name: "km_rate" }) ?? defaultKmRate;
  const location = useWatch({ name: "location" }) ?? "";
  const kmReimbursement = calculateKmReimbursement({
    kmDistance,
    kmRate,
    defaultKmRate,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h6 className="text-lg font-semibold">Spostamento</h6>
        <TravelRouteCalculatorDialog
          defaultKmRate={defaultKmRate}
          currentKmRate={kmRate}
          initialDestination={typeof location === "string" ? location : ""}
          onApply={(estimate) => {
            setValue("km_distance", estimate.totalDistanceKm, {
              shouldDirty: true,
            });
            setValue("km_rate", estimate.kmRate ?? defaultKmRate, {
              shouldDirty: true,
            });

            const currentLocation = getValues("location");
            if (
              typeof currentLocation !== "string" ||
              currentLocation.trim() === ""
            ) {
              setValue("location", estimate.generatedLocation, {
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
      <div className="text-sm font-medium px-1">
        Rimborso km:{" "}
        <span className="font-bold">
          EUR{" "}
          {kmReimbursement.toLocaleString("it-IT", {
            minimumFractionDigits: 2,
          })}
        </span>
      </div>
    </div>
  );
};

const ServiceExtraInputs = () => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Dettagli</h6>
    <TextInput source="location" label="Localit&agrave;" helperText={false} />
    <TextInput source="invoice_ref" label="Rif. Fattura" helperText={false} />
    <TextInput source="notes" label="Note" multiline helperText={false} />
  </div>
);

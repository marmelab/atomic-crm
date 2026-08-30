import { addDays } from "date-fns/addDays";
import { required, useTranslate } from "ra-core";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ReferenceInput } from "@/components/admin/reference-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import { contactOptionText } from "../misc/ContactOption";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  offerLabels,
  opportunityEntryPaths,
  opportunityOutcomes,
  opportunitySources,
  ownerDecisions,
  prospectDecisions,
} from "./opportunityConstants";

export const DealInputs = () => {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col gap-8">
      <DealInfoInputs />

      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <DealLinkedToInputs />
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <DealMiscInputs />
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <DealSalesProcessInputs />
      </div>
    </div>
  );
};

const DealInfoInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <p className="text-xs text-muted-foreground">
        {translate("resources.deals.fields.offer")}:{" "}
        {offerLabels.the_living_example}
      </p>
      <TextInput source="name" validate={required()} helperText={false} />
      <TextInput source="description" multiline rows={3} helperText={false} />
    </div>
  );
};

const DealLinkedToInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.inputs.linked_to")}
      </h3>
      <ReferenceInput source="contact_id" reference="contacts_summary">
        <AutocompleteInput
          label="resources.deals.fields.contact_id"
          optionText={contactOptionText}
          helperText={false}
          validate={required()}
        />
      </ReferenceInput>
    </div>
  );
};

const DealMiscInputs = () => {
  const { dealStages } = useConfigurationContext();
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.field_categories.misc")}
      </h3>

      <NumberInput
        source="amount"
        label="resources.deals.fields.amount"
        defaultValue={0}
        helperText={false}
        validate={required()}
      />
      <DateInput
        validate={required()}
        source="expected_closing_date"
        helperText={false}
        defaultValue={new Date().toISOString().split("T")[0]}
      />
      <SelectInput
        source="stage"
        choices={dealStages}
        optionText="label"
        optionValue="value"
        defaultValue="interested"
        helperText={false}
        validate={required()}
      />
      <SelectInput
        source="outcome"
        label="resources.deals.fields.outcome"
        choices={opportunityOutcomes}
        optionText="label"
        optionValue="value"
        helperText={false}
        emptyText="resources.deals.outcome_none"
      />
    </div>
  );
};

const DealSalesProcessInputs = () => {
  const translate = useTranslate();
  const { control, setValue, getValues } = useFormContext();
  const ownerDecision = useWatch({ control, name: "owner_decision" });
  const prospectDecision = useWatch({ control, name: "prospect_decision" });

  // Prospect decision only makes sense once the owner would work with this
  // person; switching away from that clears it so a stale decision doesn't
  // linger on an opportunity that isn't headed toward a sale anymore.
  useEffect(() => {
    if (ownerDecision !== "would_work_with" && getValues("prospect_decision")) {
      setValue("prospect_decision", null, { shouldDirty: true });
      setValue("follow_up_date", null, { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerDecision]);

  // Thinking always needs a follow-up date; default it once, on the way in.
  useEffect(() => {
    if (prospectDecision === "thinking" && !getValues("follow_up_date")) {
      setValue(
        "follow_up_date",
        addDays(new Date(), 4).toISOString().split("T")[0],
        {
          shouldDirty: true,
        },
      );
    }
    if (prospectDecision !== "thinking" && getValues("follow_up_date")) {
      setValue("follow_up_date", null, { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectDecision]);

  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.field_categories.sales_process")}
      </h3>
      <SelectInput
        source="source"
        label="resources.deals.fields.source"
        choices={opportunitySources}
        optionText="label"
        optionValue="value"
        helperText={false}
        emptyText="resources.deals.source_none"
      />
      <SelectInput
        source="entry_path"
        label="resources.deals.fields.entry_path"
        choices={opportunityEntryPaths}
        optionText="label"
        optionValue="value"
        helperText={false}
        emptyText="resources.deals.entry_path_none"
      />
      <SelectInput
        source="owner_decision"
        label="resources.deals.fields.owner_decision"
        choices={ownerDecisions}
        optionText="label"
        optionValue="value"
        helperText={false}
        emptyText="resources.deals.owner_decision_none"
      />
      {ownerDecision === "would_work_with" && (
        <SelectInput
          source="prospect_decision"
          label="resources.deals.fields.prospect_decision"
          choices={prospectDecisions}
          optionText="label"
          optionValue="value"
          helperText={false}
          emptyText="resources.deals.prospect_decision_none"
        />
      )}
      {prospectDecision === "thinking" && (
        <DateInput
          source="follow_up_date"
          label="resources.deals.fields.follow_up_date"
          helperText={false}
        />
      )}
    </div>
  );
};

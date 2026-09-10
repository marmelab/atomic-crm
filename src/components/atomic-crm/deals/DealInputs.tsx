import { required, useGetList, useGetOne, useTranslate } from "ra-core";
import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ReferenceInput } from "@/components/admin/reference-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Offer, OfferPaymentOption } from "../types";
import { resolveOpportunityAmount } from "./dealAmount";
import { OpportunityPersonInput } from "./OpportunityPersonInput";
import {
  opportunityEntryPaths,
  opportunityOutcomes,
  opportunitySources,
} from "./opportunityConstants";

export const DealInputs = () => {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col gap-8">
      <OpportunityPersonInput />
      <DealInfoInputs />

      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <DealMiscInputs />
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <DealSalesProcessInputs />
      </div>
    </div>
  );
};

const paymentOptionText = (option: OfferPaymentOption) =>
  `${option.name} — $${option.total} (${option.installments}× $${option.installment_amount})${option.is_public ? "" : " (authorized only)"}`;

const DealInfoInputs = () => {
  const { control, setValue, getValues } = useFormContext();
  const offerId = useWatch({ control, name: "offer_id" });
  const paymentOptionId = useWatch({
    control,
    name: "selected_payment_option_id",
  });
  // Scholarship Pricing + Capacity slice: pricing_mode is never edited here
  // (granting/releasing scholarship is a dedicated action — see
  // ScholarshipPricingControl.tsx's own header) — only ever read, to scope
  // which payment options this form may select among.
  const pricingMode = useWatch({ control, name: "pricing_mode" }) ?? "standard";
  const { data: offers } = useGetList<Offer>("offers", {
    pagination: { page: 1, perPage: 100 },
  });
  const selectedOffer = offers?.find(
    (offer) => String(offer.id) === String(offerId),
  );
  const isGroupOffer = selectedOffer?.type === "group";

  const { data: selectedPaymentOption } = useGetOne<OfferPaymentOption>(
    "offer_payment_options",
    { id: paymentOptionId },
    { enabled: paymentOptionId != null },
  );

  // A Cohort only ever makes sense for a group Offer. Switching to an
  // individual offer (or changing offer entirely) clears any stale
  // selection so it can never point at another offer's cohort.
  useEffect(() => {
    if (!isGroupOffer && getValues("cohort_id")) {
      setValue("cohort_id", null, { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId, isGroupOffer]);

  // A selected payment option only ever makes sense for the Offer it
  // belongs to; changing Offer away from it clears the stale selection so
  // it can never linger and drive the amount below.
  useEffect(() => {
    if (
      selectedPaymentOption &&
      String(selectedPaymentOption.offer_id) !== String(offerId)
    ) {
      setValue("selected_payment_option_id", null, { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId, selectedPaymentOption]);

  // Potential Value is never something the user types when it's already
  // encoded in the payment option: the selected option's total wins,
  // falling back to the Offer's current price with none selected (§3).
  // Skips the very first run so loading an existing Opportunity never
  // clobbers a value someone already saved.
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    const amount = resolveOpportunityAmount(
      paymentOptionId ? selectedPaymentOption : null,
      selectedOffer,
    );
    if (amount != null) {
      setValue("amount", amount, { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentOptionId, selectedPaymentOption, selectedOffer]);

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="flex flex-col sm:flex-row gap-4 [&>div]:flex-1 [&_button]:w-full">
        <ReferenceInput source="offer_id" reference="offers">
          <AutocompleteInput
            label="resources.deals.fields.offer_id"
            optionText="name"
            helperText={false}
            validate={required()}
          />
        </ReferenceInput>
        {isGroupOffer && (
          <ReferenceInput
            source="cohort_id"
            reference="cohorts"
            filter={{ offer_id: offerId }}
          >
            <AutocompleteInput
              label="resources.deals.fields.cohort_id"
              optionText="name"
              helperText={false}
            />
          </ReferenceInput>
        )}
      </div>
      {offerId && (
        <ReferenceInput
          source="selected_payment_option_id"
          reference="offer_payment_options"
          filter={{ offer_id: offerId, pricing_mode: pricingMode }}
        >
          <AutocompleteInput
            label="resources.deals.fields.selected_payment_option_id"
            optionText={paymentOptionText}
            helperText={false}
            className="w-full [&_button]:w-full"
          />
        </ReferenceInput>
      )}
      <TextInput source="description" multiline rows={3} helperText={false} />
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

// Human-acceptance repair pass (Sales Call discoverability, §3): owner_
// decision, prospect_decision, follow_up_date, and sales_call_at used to
// live here as raw editable fields — which is exactly how a real accepted
// call ended up recorded as "Would Work With / Yes" while the Opportunity
// silently stayed at Call Booked (generic Edit writes the raw fields with
// no synchronization). These are business EVENTS now, not metadata: they
// can only be safely mutated through the Complete Sales Call action
// (sales-calls/CompleteSalesCallDialog.tsx), which keeps sales_calls,
// Sales Call Events, stage/outcome, Tasks, and Contact DNE state in sync
// the way a raw field edit never can. The underlying columns are
// untouched — only this form's field list changed.
const DealSalesProcessInputs = () => {
  const translate = useTranslate();

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
    </div>
  );
};

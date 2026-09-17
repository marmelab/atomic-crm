import { useEffect, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { required, useGetOne, useTranslate, type Identifier } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";

import { CreateDialog } from "../misc/CreateDialog";
import type { Offer } from "../types";
import { NEW_BUSINESS_OFFERS_FILTER } from "../offers/newBusinessOffers";

// The Contact-page counterpart to AddToWaitlistSheet.tsx. That one is
// opened FROM a Program/Cohort page, so the Offer (and sometimes the
// Cohort) is already implied and never asked. Here the Contact is the
// fixed thing and the Offer is the question, so it is the one field this
// sheet adds. Everything else — the Waitlist Entry shape, duplicate
// protection, statuses — is the existing model, unchanged.
export const ContactAddToWaitlistSheet = ({
  open,
  onOpenChange,
  contactId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: Identifier;
}) => {
  const translate = useTranslate();

  // Frozen for the sheet's open lifecycle for the same reason
  // AddToWaitlistSheet.tsx freezes it: ra-core re-derives defaultValues
  // from JSON.stringify and resets the form whenever that string changes,
  // so a fresh timestamp on every render would wipe the user's input on
  // any incidental re-render. A manual add really is happening now, so
  // now() is the truthful join evidence here (unlike an imported
  // historical row, which keeps its own source timestamp).
  const joinedAt = useMemo(() => new Date().toISOString(), [open]);

  return (
    <CreateDialog
      resource="waitlist_entries"
      title={translate("resources.waitlist_entries.sheet.add", {
        _: "Add to Waitlist",
      })}
      redirect={false}
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        contact_id: contactId,
        cohort_id: null,
        status: "waiting",
        // Leif is creating this by hand, so the origin is known: "manual",
        // never the "Unknown" an empty attribution field rendered as.
        source: "manual",
        joined_at: joinedAt,
      }}
    >
      <div className="flex flex-col gap-4">
        <OfferAndCohortInputs />
        <TextInput
          source="desired_timing"
          label={translate("resources.waitlist_entries.fields.desired_timing", {
            _: "Desired timing",
          })}
          helperText={false}
        />
        <TextInput
          source="notes"
          label={translate("resources.waitlist_entries.fields.notes", {
            _: "Notes",
          })}
          multiline
          helperText={false}
        />
      </div>
    </CreateDialog>
  );
};

// Offer is required; Cohort is offered only for a group Offer, exactly as
// DealInputs.tsx does it — an individual Offer (The Living Example) has no
// cohorts, so asking would be meaningless. Waiting for the Offer itself
// and waiting for one specific Cohort are both legitimate, distinct facts,
// so Cohort stays optional rather than forced.
const OfferAndCohortInputs = () => {
  const { control, setValue, getValues } = useFormContext();
  const offerId = useWatch({ control, name: "offer_id" });
  const { data: selectedOffer } = useGetOne<Offer>(
    "offers",
    { id: offerId },
    { enabled: offerId != null },
  );
  const isGroupOffer = selectedOffer?.type === "group";

  // Changing to an individual Offer clears any stale Cohort so an entry can
  // never point at another Offer's Cohort.
  useEffect(() => {
    if (!isGroupOffer && getValues("cohort_id")) {
      setValue("cohort_id", null, { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId, isGroupOffer]);

  return (
    <div className="flex flex-col gap-4">
      <ReferenceInput
        source="offer_id"
        reference="offers"
        filter={NEW_BUSINESS_OFFERS_FILTER}
      >
        <AutocompleteInput
          label="resources.waitlist_entries.fields.offer_id"
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
            label="resources.waitlist_entries.fields.cohort_id"
            optionText="name"
            helperText={false}
          />
        </ReferenceInput>
      )}
    </div>
  );
};

import {
  useCreate,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRecordContext,
  required,
  useTranslate,
} from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Ban } from "lucide-react";

import type { Contact, Deal } from "../types";
import { doNotEngageValidator } from "../contacts/doNotEngageGuard";
import { personOptionText } from "./PersonOption";

// The single "PERSON" field for the Opportunity create/edit form (§1 of the
// Programs + Opportunity UX slice), replacing the old separate Name +
// "Linked to (Contact)" fields. Type-ahead search reuses every existing
// Contact so a returning client's history is never duplicated (§2); no
// match offers an inline "Add as a new person" quick-create instead of
// requiring "create a Contact first, then link an Opportunity" thinking.
//
// The Opportunity's `name` is never collected here — it is always derived
// from the selected Contact server-side (see dataProvider.ts's "deals"
// beforeCreate/beforeUpdate and handle_deal_saved()), so an Opportunity can
// never silently represent a different person than the one it's linked to.
//
// Quick-create uses the simple `onCreate` callback (same proven pattern as
// companies/AutocompleteCompanyInput.tsx), not AutocompleteInput's richer
// `create` element: that path crashes with "useCreateSuggestionContext must
// be used inside a CreateSuggestionContext.Provider" (a latent bug in the
// shared src/hooks/useSupportCreateSuggestion.tsx / admin/autocomplete-
// input.tsx, never previously exercised by this codebase — every other
// quick-create here uses `onCreate`). Filed as a backlog item, not fixed in
// this slice — see the slice report. Only first/last name are collected
// here (split from what was typed); email isn't required to create a
// Contact and can be added later from the Contact record.
export const OpportunityPersonInput = () => {
  const translate = useTranslate();
  const [create] = useCreate();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const dataProvider = useDataProvider();
  const existingDeal = useRecordContext<Deal>();
  const isCreatingNewOpportunity = existingDeal?.id == null;
  const { control } = useFormContext();
  const selectedContactId = useWatch({ control, name: "contact_id" });
  const { data: selectedContact } = useGetOne<Contact>(
    "contacts",
    { id: selectedContactId },
    { enabled: selectedContactId != null },
  );
  const isDoNotEngage = selectedContact?.sales_eligibility === "do_not_engage";

  const doNotEngageMessage = translate(
    "resources.deals.person_input.do_not_engage_error",
    {
      _: "This person is marked Do Not Engage — a new Opportunity can't be created for them.",
    },
  );

  const handleCreatePerson = async (name?: string) => {
    if (!name) return;
    const [firstName, ...rest] = name.trim().split(/\s+/).filter(Boolean);
    try {
      const newContact = await create(
        "contacts",
        {
          data: {
            first_name: firstName ?? name,
            last_name: rest.join(" "),
            email_jsonb: [],
            phone_jsonb: [],
            tags: [],
            sales_id: identity?.id,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      );
      return newContact;
    } catch {
      notify("resources.deals.person_input.create_error", {
        type: "error",
        messageArgs: { _: "An error occurred while creating the person" },
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.person_input.label", { _: "Person" })}
      </h3>
      <ReferenceInput source="contact_id" reference="contacts_summary">
        <AutocompleteInput
          label={false}
          placeholder={translate("resources.deals.person_input.placeholder", {
            _: "Search by name or email…",
          })}
          optionText={personOptionText}
          inputText={(choice: Contact | undefined) =>
            choice ? `${choice.first_name} ${choice.last_name}` : ""
          }
          helperText={false}
          validate={[
            required(),
            doNotEngageValidator(
              dataProvider,
              doNotEngageMessage,
              isCreatingNewOpportunity,
            ),
          ]}
          onCreate={handleCreatePerson}
          createLabel="resources.deals.person_input.create_label"
          createItemLabel="resources.deals.person_input.create_item_label"
        />
      </ReferenceInput>
      {isCreatingNewOpportunity && isDoNotEngage && (
        <Alert variant="destructive">
          <Ban />
          <AlertTitle>
            {translate("resources.deals.person_input.do_not_engage_title", {
              _: "Do Not Engage",
            })}
          </AlertTitle>
          <AlertDescription>{doNotEngageMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

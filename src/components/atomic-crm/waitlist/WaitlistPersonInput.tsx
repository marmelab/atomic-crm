import {
  useCreate,
  useDataProvider,
  useGetIdentity,
  useNotify,
  required,
  useTranslate,
  type Identifier,
} from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";

import type { Contact } from "../types";
import { doNotEngageValidator } from "../contacts/doNotEngageGuard";
import { personOptionText } from "../deals/PersonOption";
import { findActiveWaitlistEntry } from "./waitlistEntryValidation";

// The "Person" field for Add to Waitlist (Waitlists slice, §9) — same
// person-first conventions as the Opportunity Person field
// (deals/OpportunityPersonInput.tsx): search reuses every existing
// Contact, quick-create for a brand-new one, Do Not Engage stays visible/
// selectable but blocks submission (§5). Adds a second async validator for
// the duplicate-active-entry rule (§4) so the mistake surfaces immediately
// rather than as a raw write failure from the FakeRest hook / Postgres
// constraint.
export const WaitlistPersonInput = ({
  offerId,
  cohortId,
}: {
  offerId: Identifier;
  cohortId: Identifier | null;
}) => {
  const translate = useTranslate();
  const [create] = useCreate();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const dataProvider = useDataProvider();

  const doNotEngageMessage = translate(
    "resources.waitlist_entries.person_input.do_not_engage_error",
    {
      _: "This person is marked Do Not Engage — they can't be added to a waitlist.",
    },
  );
  const duplicateMessage = translate(
    "resources.waitlist_entries.person_input.duplicate_error",
    { _: "This person is already waiting for this program." },
  );

  const validateDuplicate = async (value?: Identifier) => {
    if (!value) return undefined;
    const existing = await findActiveWaitlistEntry(dataProvider, {
      contactId: value,
      offerId,
      cohortId,
    });
    return existing ? duplicateMessage : undefined;
  };

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
      notify("resources.waitlist_entries.person_input.create_error", {
        type: "error",
        messageArgs: { _: "An error occurred while creating the person" },
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
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
            doNotEngageValidator(dataProvider, doNotEngageMessage),
            validateDuplicate,
          ]}
          onCreate={handleCreatePerson}
          createLabel="resources.deals.person_input.create_label"
          createItemLabel="resources.deals.person_input.create_item_label"
        />
      </ReferenceInput>
    </div>
  );
};

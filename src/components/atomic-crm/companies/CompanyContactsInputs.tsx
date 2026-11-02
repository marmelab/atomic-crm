import {
  email,
  required,
  useDataProvider,
  useNotify,
  useSimpleFormIterator,
  useSimpleFormIteratorItem,
  useSourceContext,
  useTranslate,
  type Validator,
} from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { UserPlus } from "lucide-react";
import { ArrayInput } from "@/components/admin/array-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { contactOptionText } from "../misc/ContactOption";
import {
  toCompanyContactInput,
  type CompanyContactInput,
} from "../providers/commons/companyContacts";
import type { Contact } from "../types";
import { CONTACT_SEARCH_SOURCE } from "./companyForm";

const NEW_CONTACT: CompanyContactInput = {
  first_name: "",
  last_name: "",
  title: "",
  mobile: "",
  whatsapp_number: "",
  email: "",
  is_primary: false,
};

/**
 * The single place where a company's contacts are managed: link existing
 * contacts, create new ones, edit or unlink them. The list is saved with the
 * company, see save_company_with_contacts().
 */
export const CompanyContactsInputs = () => {
  const translate = useTranslate();
  const contacts: CompanyContactInput[] = useWatch({ name: "contacts" }) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.contacts", {
          _: "Contacts",
        })}
      </h6>

      <ExistingContactSearch />

      {contacts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {translate("resources.companies.contacts.empty", {
            _: "No contacts yet. Search an existing contact or add a new one.",
          })}
        </p>
      )}

      <ArrayInput source="contacts" label={false} helperText={false}>
        <SimpleFormIterator
          disableReordering
          disableClear
          fullWidth
          getItemLabel={false}
          addButton={<AddNewContactButton />}
        >
          <CompanyContactItem />
        </SimpleFormIterator>
      </ArrayInput>
    </div>
  );
};

const ExistingContactSearch = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider();
  const { getValues, setValue } = useFormContext();

  const handleSelect = async (id: Contact["id"] | "" | null) => {
    if (id == null || id === "") return;
    setValue(CONTACT_SEARCH_SOURCE, null);

    const contacts: CompanyContactInput[] = getValues("contacts") ?? [];
    if (contacts.some((contact) => contact.id === id)) {
      notify("resources.companies.contacts.already_added", {
        type: "warning",
        messageArgs: { _: "This contact is already in the list" },
      });
      return;
    }
    try {
      const { data } = await dataProvider.getOne<Contact>("contacts", { id });
      setValue("contacts", [...contacts, toCompanyContactInput(data)], {
        shouldDirty: true,
      });
    } catch {
      notify("resources.companies.contacts.fetch_error", {
        type: "error",
        messageArgs: { _: "Could not load this contact" },
      });
    }
  };

  return (
    <ReferenceInput source={CONTACT_SEARCH_SOURCE} reference="contacts_summary">
      <AutocompleteInput
        label="resources.companies.fields.existing_contact_ids"
        optionText={contactOptionText}
        inputText={() => ""}
        placeholder={translate("resources.companies.contacts.search", {
          _: "Search existing contacts…",
        })}
        helperText="resources.companies.contacts.search_help"
        onChange={handleSelect}
      />
    </ReferenceInput>
  );
};

const AddNewContactButton = () => {
  const translate = useTranslate();
  const { add } = useSimpleFormIterator();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => add({ ...NEW_CONTACT })}
    >
      <UserPlus />
      {translate("resources.companies.contacts.add_new", {
        _: "Add new contact",
      })}
    </Button>
  );
};

/** Same email twice in the list would create duplicate contacts. */
const uniqueEmail: Validator = (value, allValues) => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  const count = (allValues.contacts ?? []).filter(
    (contact: CompanyContactInput) =>
      contact.email?.trim().toLowerCase() === normalized,
  ).length;
  return count > 1 ? "resources.companies.contacts.duplicate_email" : undefined;
};

const CompanyContactItem = () => {
  const translate = useTranslate();
  const { getSource } = useSourceContext();
  const id = useWatch({ name: getSource("id") });
  const isExisting = id != null && id !== "";

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={isExisting ? "secondary" : "outline"}>
          {isExisting
            ? translate("resources.companies.contacts.existing", {
                _: "Existing contact",
              })
            : translate("resources.companies.contacts.new", {
                _: "New contact",
              })}
        </Badge>
        <PrimaryContactInput />
      </div>
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        <TextInput
          source="first_name"
          label="resources.contacts.fields.first_name"
          validate={required()}
          helperText={false}
        />
        <TextInput
          source="last_name"
          label="resources.contacts.fields.last_name"
          validate={required()}
          helperText={false}
        />
        <TextInput
          source="title"
          label="resources.contacts.fields.title"
          helperText={false}
        />
        <TextInput
          source="mobile"
          label="resources.companies.contacts.mobile"
          helperText={false}
        />
        <TextInput
          source="whatsapp_number"
          label="resources.contacts.fields.whatsapp_number"
          helperText={false}
        />
        <TextInput
          source="email"
          label="resources.contacts.fields.email"
          validate={[email(), uniqueEmail]}
          helperText={false}
        />
      </div>
      {isExisting && (
        <p className="text-xs text-muted-foreground">
          {translate("resources.companies.contacts.existing_help", {
            _: "Changes update this contact everywhere in the CRM. Removing it only unlinks it from the company.",
          })}
        </p>
      )}
    </div>
  );
};

/** At most one primary contact: switching one on switches the others off. */
const PrimaryContactInput = () => {
  const { index } = useSimpleFormIteratorItem();
  const { getValues, setValue } = useFormContext();

  const handleChange = (isPrimary: boolean) => {
    if (!isPrimary) return;
    const contacts: CompanyContactInput[] = getValues("contacts") ?? [];
    contacts.forEach((contact, i) => {
      if (i !== index && contact.is_primary) {
        setValue(`contacts.${i}.is_primary`, false, { shouldDirty: true });
      }
    });
  };

  return (
    <BooleanInput
      source="is_primary"
      label="resources.companies.contacts.primary"
      helperText={false}
      onChange={handleChange}
    />
  );
};

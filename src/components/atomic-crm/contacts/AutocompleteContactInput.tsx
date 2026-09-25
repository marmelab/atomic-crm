import { useCreateSuggestionContext } from "ra-core";
import type { InputProps, RaRecord } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import { useWatch } from "react-hook-form";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";

import { contactOptionText } from "../misc/ContactOption";
import { ContactCreateSheet } from "./ContactCreateSheet";

/**
 * Autocomplete input to pick several contacts, with on the fly creation.
 *
 * Unlike a company — which a name is enough to create — a contact needs a form,
 * so picking "Create ..." opens the contact creation sheet rather than creating
 * the record silently.
 */
export const AutocompleteContactInput = ({
  validate,
  label,
}: Pick<InputProps, "validate" | "label">) => (
  <AutocompleteArrayInput
    label={label}
    validate={validate}
    optionText={contactOptionText}
    helperText={false}
    create={<CreateContact />}
    createItemLabel="resources.contacts.autocomplete.create_item"
    createLabel="resources.contacts.autocomplete.create_label"
  />
);

const splitFullName = (fullName: string | undefined) => {
  const [first_name, ...rest] = (fullName ?? "").trim().split(/\s+/);
  return { first_name, last_name: rest.join(" ") };
};

const CreateContact = () => {
  const { filter, onCancel, onCreate } = useCreateSuggestionContext();
  const queryClient = useQueryClient();
  const company_id = useWatch({ name: "company_id" });

  const handleSuccess = (contact: RaRecord) => {
    queryClient.invalidateQueries({ queryKey: ["contacts_summary"] });
    onCreate(contact);
  };

  return (
    <ContactCreateSheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      defaultValues={{ ...splitFullName(filter), company_id }}
      mutationOptions={{ onSuccess: handleSuccess }}
      redirect={false}
    />
  );
};

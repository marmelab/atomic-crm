import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import type { Contact } from "../types";

export const AutocompleteContactInput = () => {
  const [create] = useCreate();
  const { identity } = useGetIdentity();
  const notify = useNotify();

  const handleCreateContact = async (name?: string) => {
    if (!name) return;

    // Parse name into first and last name
    const nameParts = name.trim().split(" ");
    const first_name = nameParts[0] || "";
    const last_name = nameParts.slice(1).join(" ") || "";

    try {
      const newContact = await create(
        "contacts",
        {
          data: {
            first_name,
            last_name,
            sales_id: identity?.id,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            tags: [],
            email_jsonb: [],
            phone_jsonb: [],
          },
        },
        { returnPromise: true },
      );
      return newContact;
    } catch {
      notify("An error occurred while creating the contact", {
        type: "error",
      });
    }
  };

  const optionRenderer = (choice: Contact) =>
    `${choice.first_name} ${choice.last_name}`;

  return (
    <AutocompleteInput
      optionText={optionRenderer}
      helperText={false}
      onCreate={handleCreateContact}
      createItemLabel="Create contact %{item}"
      filterToQuery={(searchText) => ({ q: searchText })}
    />
  );
};

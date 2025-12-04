import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import type { InputProps } from "ra-core";

export const AutocompleteCompanyInput = ({
  validate,
}: Pick<InputProps, "validate">) => {
  const [create] = useCreate();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const handleCreateCompany = async (name?: string) => {
    if (!name) return;
    try {
      const newCompany = await create(
        "companies",
        {
          data: {
            name,
            sales_id: identity?.id,
            created_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      );
      return newCompany;
    } catch {
      notify("An error occurred while creating the company", {
        type: "error",
      });
    }
  };

  return (
    <AutocompleteInput
      optionText="name"
      helperText={false}
      onCreate={handleCreateCompany}
      createItemLabel="Create %{item}"
      createLabel="Start typing to create a new company"
      validate={validate}
    />
  );
};

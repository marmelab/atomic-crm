import { useCreate, useGetIdentity, useNotify, useTranslate } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import type { InputProps } from "ra-core";

export const AutocompleteCompanyInput = ({
  validate,
  label,
}: Pick<InputProps, "validate" | "label">) => {
  const [create] = useCreate();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const translate = useTranslate();
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
      notify("crm.companies.autocomplete.create_error", {
        type: "error",
        messageArgs: {
          _: "An error occurred while creating the company",
        },
      });
    }
  };

  return (
    <AutocompleteInput
      label={label}
      optionText="name"
      helperText={false}
      onCreate={handleCreateCompany}
      createItemLabel={translate("crm.companies.autocomplete.create_item", {
        _: "Create %{item}",
      })}
      createLabel={translate("crm.companies.autocomplete.create_label", {
        _: "Start typing to create a new company",
      })}
      validate={validate}
    />
  );
};

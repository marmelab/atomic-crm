import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import type { InputProps } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PopoverProps } from "@radix-ui/react-popover";

export const AutocompleteCompanyInput = ({
  validate,
  label,
  modal,
}: Pick<InputProps, "validate" | "label"> & Pick<PopoverProps, "modal">) => {
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
      notify("resources.companies.autocomplete.create_error", {
        type: "error",
        messageArgs: {
          _: "An error occurred while creating the company",
        },
      });
    }
  };
  const isMobile = useIsMobile();

  return (
    <AutocompleteInput
      label={label}
      optionText="name"
      helperText={false}
      onCreate={handleCreateCompany}
      createItemLabel="resources.companies.autocomplete.create_item"
      createLabel="resources.companies.autocomplete.create_label"
      validate={validate}
      modal={modal ?? isMobile}
    />
  );
};

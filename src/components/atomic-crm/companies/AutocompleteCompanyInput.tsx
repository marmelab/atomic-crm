import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { useFormContext } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import type { InputProps } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Popover as PopoverPrimitive } from "@base-ui/react/popover";

export const AutocompleteCompanyInput = ({
  validate,
  label,
  modal,
  draftSource,
}: Pick<InputProps, "validate" | "label"> &
  Pick<PopoverPrimitive.Root.Props, "modal"> & {
    /**
     * Form field that receives the typed company name, so the form can create
     * the company on save when the user typed a name but never picked an option.
     */
    draftSource?: string;
  }) => {
  const [create] = useCreate();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const { setValue } = useFormContext();
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
      onFilterChange={
        draftSource
          ? (filter) => setValue(draftSource, filter, { shouldDirty: true })
          : undefined
      }
      createItemLabel="resources.companies.autocomplete.create_item"
      createLabel="resources.companies.autocomplete.create_label"
      validate={validate}
      modal={modal ?? isMobile}
    />
  );
};

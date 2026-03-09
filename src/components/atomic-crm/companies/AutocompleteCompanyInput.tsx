import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import type { InputProps } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";

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
      notify("Erreur lors de la création de la société", {
        type: "error",
      });
    }
  };
  const isMobile = useIsMobile();

  return (
    <AutocompleteInput
      optionText="name"
      helperText={false}
      onCreate={handleCreateCompany}
      createItemLabel="Créer %{item}"
      createLabel="Tapez pour créer une nouvelle société"
      validate={validate}
      modal={isMobile}
    />
  );
};

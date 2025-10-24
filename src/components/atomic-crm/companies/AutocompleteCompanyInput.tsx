import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { AutocompleteInput } from "@/components/admin";

export const AutocompleteCompanyInput = () => {
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
    />
  );
};

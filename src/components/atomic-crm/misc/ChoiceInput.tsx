import type { InputProps } from "ra-core";
import { useCreate, useGetList, useNotify } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";

import type { Choice } from "../types";

/** Categories of the `choices` referential, one per user-extensible list. */
export type ChoiceCategory =
  | "company_sector"
  | "deal_origin"
  | "deal_objective"
  | "rdv_mode"
  | "rdv_type";

const MAX_CHOICES = 200;

export interface ChoiceInputProps
  extends Pick<InputProps, "source" | "label" | "validate" | "helperText"> {
  category: ChoiceCategory;
  /** Render a multi-value input storing an array of labels. */
  multiple?: boolean;
}

/**
 * Autocomplete backed by the `choices` referential. The record stores the
 * chosen label(s), not a foreign key, so removing an option never orphans data.
 * Typing an unknown value offers to add it to the shared list.
 */
export const ChoiceInput = ({
  category,
  multiple = false,
  ...props
}: ChoiceInputProps) => {
  const { data, refetch } = useGetList<Choice>("choices", {
    filter: { category },
    pagination: { page: 1, perPage: MAX_CHOICES },
    sort: { field: "id", order: "ASC" },
  });
  const [create] = useCreate();
  const notify = useNotify();

  const handleCreate = async (label?: string) => {
    const newLabel = label?.trim();
    if (!newLabel) return;
    const existing = data?.find(
      (choice) => choice.label.toLowerCase() === newLabel.toLowerCase(),
    );
    if (existing) return existing;
    try {
      const created = await create(
        "choices",
        { data: { category, label: newLabel } },
        { returnPromise: true },
      );
      await refetch();
      return created;
    } catch {
      notify("crm.choices.create_error", {
        type: "error",
        messageArgs: { _: "An error occurred while creating the option" },
      });
    }
  };

  const commonProps = {
    choices: data ?? [],
    optionText: "label" as const,
    optionValue: "label" as const,
    translateChoice: false,
    helperText: false as const,
    onCreate: handleCreate,
    createLabel: "crm.choices.create_label",
    ...props,
  };

  return multiple ? (
    <AutocompleteArrayInput {...commonProps} defaultValue={[]} />
  ) : (
    <AutocompleteInput
      {...commonProps}
      createItemLabel="crm.choices.create_item"
    />
  );
};

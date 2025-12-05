import type { ReferenceInputBaseProps } from "ra-core";
import { ReferenceInputBase } from "ra-core";
import { AutocompleteInput } from "./autocomplete-input";

/**
 * Form input for editing foreign key relationships with autocompletion.
 *
 * This component fetches related records from a reference resource and displays them in a searchable dropdown using AutocompleteInput.
 * Use it to edit many-to-one relationships, where the current record has a foreign key to another resource.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/referenceinput/ ReferenceInput documentation}
 *
 * @example
 * import { Edit, SimpleForm, TextInput, ReferenceInput } from '@/components/admin';
 *
 * const ContactEdit = () => (
 *   <Edit>
 *     <SimpleForm>
 *       <TextInput source="first_name" />
 *       <TextInput source="last_name" />
 *       <TextInput source="title" />
 *       <ReferenceInput source="company_id" reference="companies" />
 *     </SimpleForm>
 *   </Edit>
 * );
 */
export const ReferenceInput = (props: ReferenceInputProps) => {
  const { children = defaultChildren, ...rest } = props;

  if (props.validate && process.env.NODE_ENV !== "production") {
    throw new Error(
      "<ReferenceInput> does not accept a validate prop. Set the validate prop on the child instead.",
    );
  }

  return <ReferenceInputBase {...rest}>{children}</ReferenceInputBase>;
};

const defaultChildren = <AutocompleteInput />;

export interface ReferenceInputProps extends ReferenceInputBaseProps {
  /**
   * Call validate on the child component instead
   */
  validate?: never;
}

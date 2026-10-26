import * as React from "react";
import type { ReactElement } from "react";
import type { InputProps, UseReferenceArrayInputParams } from "ra-core";
import {
  useReferenceArrayInputController,
  ResourceContextProvider,
  ChoicesContextProvider,
} from "ra-core";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";

/**
 * Form input for editing arrays of foreign key relationships with autocompletion.
 *
 * This component fetches related records from a reference resource and displays them
 * in a searchable multi-select interface using AutocompleteArrayInput.
 * Use it to edit one-to-many or many-to-many relationships, where the current record
 * has an array of foreign keys to another resource.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/referencearrayinput/ ReferenceArrayInput documentation}
 *
 * @example
 * import { Edit, SimpleForm, TextInput, ReferenceArrayInput } from '@/components/admin';
 *
 * const PostEdit = () => (
 *   <Edit>
 *     <SimpleForm>
 *       <TextInput source="title" />
 *       <ReferenceArrayInput source="tag_ids" reference="tags" />
 *     </SimpleForm>
 *   </Edit>
 * );
 */
export const ReferenceArrayInput = (props: ReferenceArrayInputProps) => {
  const {
    children = defaultChildren,
    reference,
    sort,
    filter = defaultFilter,
  } = props;
  if (React.Children.count(children) !== 1) {
    throw new Error(
      "<ReferenceArrayInput> only accepts a single child (like <AutocompleteArrayInput>)",
    );
  }

  const controllerProps = useReferenceArrayInputController({
    ...props,
    sort,
    filter,
  });

  return (
    <ResourceContextProvider value={reference}>
      <ChoicesContextProvider value={controllerProps}>
        {children}
      </ChoicesContextProvider>
    </ResourceContextProvider>
  );
};

const defaultChildren = <AutocompleteArrayInput />;
const defaultFilter = {};

export interface ReferenceArrayInputProps
  extends InputProps, UseReferenceArrayInputParams {
  children?: ReactElement;
}

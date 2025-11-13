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
 * An Input component for fields containing a list of references to another resource.
 * Useful for 'hasMany' relationship.
 *
 * @example
 * The post object has many tags, so the post resource looks like:
 * {
 *    id: 1234,
 *    tag_ids: [ "1", "23", "4" ]
 * }
 *
 * ReferenceArrayInput component fetches the current resources (using
 * `dataProvider.getMany()`) as well as possible resources (using
 * `dataProvider.getList()`) in the reference endpoint. It then
 * delegates rendering to its child component, to which it makes the possible
 * choices available through the ChoicesContext.
 *
 * @example
 * export const PostEdit = () => (
 *     <Edit>
 *         <SimpleForm>
 *             <ReferenceArrayInput source="tag_ids" reference="tags" />
 *         </SimpleForm>
 *     </Edit>
 * );
 *
 * By default, restricts the possible values to 25. You can extend this limit
 * by setting the `perPage` prop.
 *
 * @example
 * <ReferenceArrayInput
 *      source="tag_ids"
 *      reference="tags"
 *      perPage={100}
 * />
 *
 * By default, orders the possible values by id desc. You can change this order
 * by setting the `sort` prop (an object with `field` and `order` properties).
 *
 * @example
 * <ReferenceArrayInput
 *      source="tag_ids"
 *      reference="tags"
 *      sort={{ field: 'name', order: 'ASC' }}
 * />
 *
 * Also, you can filter the query used to populate the possible values. Use the
 * `filter` prop for that.
 *
 * @example
 * <ReferenceArrayInput
 *      source="tag_ids"
 *      reference="tags"
 *      filter={{ is_public: true }}
 * />
 *
 * The enclosed component may filter results. ReferenceArrayInput create a ChoicesContext which provides
 * a `setFilters` function. You can call this function to filter the results.
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
  extends InputProps,
    UseReferenceArrayInputParams {
  children?: ReactElement;
}

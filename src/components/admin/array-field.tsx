import type { ReactNode } from "react";
import type { RaRecord, UseListOptions, UseFieldValueOptions } from "ra-core";
import { ListContextProvider, useList, useFieldValue } from "ra-core";

/**
 * Reads an array field value, puts it in a ListContext and renders its children.
 *
 * This field enables the use of list rendering components like SingleFieldList or
 * DataTable to display array data.
 * To be used with RecordField or DataTable.Col components, or anywhere a RecordContext is available.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/arrayfield/ ArrayField documentation}
 *
 * @example
 * import {
 *   Show,
 *   ArrayField,
 *   RecordField,
 *   SingleFieldList,
 *   BadgeField,
 * } from '@/components/admin';
 *
 * const PostShow = () => (
 *   <Show>
 *     <div className="flex flex-col gap-4">
 *      <RecordField source="title" />
 *      <RecordField source="content" />
 *      <RecordField source="tags">
 *         <ArrayField source="tags">
 *           <SingleFieldList>
 *             <BadgeField source="name" />
 *           </SingleFieldList>
 *         </ArrayField>
 *      </RecordField>
 *     </div>
 *   </Show>
 * );
 */
export const ArrayField = <RecordType extends RaRecord = RaRecord>(
  props: ArrayFieldProps<RecordType>,
) => {
  const { children, resource, perPage, sort, filter } = props;
  const data = useFieldValue(props) || emptyArray;
  const listContext = useList({ data, resource, perPage, sort, filter });

  return (
    <ListContextProvider value={listContext}>{children}</ListContextProvider>
  );
};
export type ArrayFieldProps<
  RecordType extends RaRecord = RaRecord,
  ErrorType = Error,
> = UseListOptions<RecordType, ErrorType> &
  UseFieldValueOptions<RecordType> & {
    children?: ReactNode;
  };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emptyArray: any[] = [];

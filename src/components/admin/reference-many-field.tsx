import type { ReactNode } from "react";
import type {
  RaRecord,
  UseReferenceManyFieldControllerParams,
  ListControllerResult,
} from "ra-core";
import { ReferenceManyFieldBase, useListContext } from "ra-core";

/**
 * Displays multiple related records that reference the current record via a foreign key.
 *
 * This field fetches records from a related resource where the foreign key points to the current record.
 * It provides a ListContext to its children, enabling list rendering with DataTable or custom components.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/referencemanyfield/ ReferenceManyField documentation}
 *
 * @example
 * import { Show, ReferenceManyField, DataTable, DateField, RecordField } from '@/components/admin';
 *
 * const AuthorShow = () => (
 *   <Show>
 *     <div className="flex flex-col gap-4">
 *       <RecordField source="first_name" />
 *       <RecordField source="last_name" />
 *       <RecordField label="Books">
 *         <ReferenceManyField reference="books" target="author_id" label="Books">
 *           <DataTable>
 *             <DataTable.Col source="title" />
 *             <DataTable.Col source="published_at" field={DateField} />
 *           </DataTable>
 *         </ReferenceManyField>
 *       </RecordField>
 *     </div>
 *   </Show>
 * );
 */
export const ReferenceManyField = <
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
>(
  props: ReferenceManyFieldProps<RecordType, ReferenceRecordType>,
) => {
  const { children, empty, error, loading, pagination, render, ...rest } =
    props;

  return (
    <ReferenceManyFieldBase {...rest}>
      <ReferenceManyFieldView<ReferenceRecordType>
        empty={empty}
        error={error}
        loading={loading}
        pagination={pagination}
        render={render}
      >
        {children}
      </ReferenceManyFieldView>
    </ReferenceManyFieldBase>
  );
};

export interface ReferenceManyFieldProps<
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
>
  extends
    UseReferenceManyFieldControllerParams<RecordType, ReferenceRecordType>,
    ReferenceManyFieldViewProps<ReferenceRecordType> {}

const ReferenceManyFieldView = <
  ReferenceRecordType extends RaRecord = RaRecord,
>(
  props: ReferenceManyFieldViewProps<ReferenceRecordType>,
) => {
  const {
    children,
    empty,
    error: errorElement,
    loading,
    pagination,
    render,
  } = props;
  const listContext = useListContext();
  const {
    isPending,
    error,
    total,
    hasPreviousPage,
    hasNextPage,
    data,
    filterValues,
  } = listContext;

  if (isPending && loading !== false) {
    return loading;
  }
  if (error && errorElement !== false) {
    return errorElement;
  }
  if (
    (total === 0 ||
      (total == null &&
        hasPreviousPage === false &&
        hasNextPage === false &&
        // @ts-expect-error FIXME total may be undefined when using partial pagination but the ListControllerResult type is wrong about it
        data.length === 0 &&
        // the user didn't set any filters
        !Object.keys(filterValues).length)) &&
    empty !== false
  ) {
    return empty;
  }

  return (
    <>
      {render && render(listContext)}
      {children}
      {pagination}
    </>
  );
};

export interface ReferenceManyFieldViewProps<
  ReferenceRecordType extends RaRecord = RaRecord,
> {
  children?: ReactNode;
  empty?: ReactNode;
  error?: ReactNode;
  loading?: ReactNode;
  pagination?: ReactNode;
  render?: (props: ListControllerResult<ReferenceRecordType>) => ReactNode;
}

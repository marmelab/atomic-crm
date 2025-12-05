import type { ReactElement, ReactNode } from "react";
import { memo } from "react";
import type {
  FilterPayload,
  ListControllerResult,
  RaRecord,
  SortPayload,
  ExtractRecordPaths,
  HintedString,
} from "ra-core";
import { ReferenceArrayFieldBase, useListContext } from "ra-core";
import type { UseQueryOptions } from "@tanstack/react-query";
import { SingleFieldList } from "@/components/admin/single-field-list";

/**
 * Displays multiple related records by following an array of foreign keys.
 *
 * This field fetches related records using an array of IDs and renders them using a child component (SingleFieldList by default).
 * It supports custom sorting, filtering, and rendering with DataTable or other list components.
 * To be used with RecordField or DataTable.Col components, or anywhere a RecordContext is available.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/referencearrayfield/ ReferenceArrayField documentation}
 *
 * @example
 * import { List, DataTable, ReferenceArrayField } from '@/components/admin';
 *
 * export const PostList = () => (
 *   <List>
 *     <DataTable>
 *       <DataTable.Col source="id" />
 *       <DataTable.Col source="title" />
 *       <DataTable.Col source="tag_ids" label="Tags">
 *         <ReferenceArrayField reference="tags" source="tag_ids" />
 *       </DataTable.Col>
 *       <DataTable.Col>
 *         <EditButton />
 *       </DataTable.Col>
 *     </DataTable>
 *   </List>
 * );
 */
export const ReferenceArrayField = <
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
>(
  props: ReferenceArrayFieldProps<RecordType, ReferenceRecordType>,
) => {
  const {
    filter,
    page = 1,
    perPage,
    reference,
    resource,
    sort,
    source,
    queryOptions,
    render,
    ...rest
  } = props;
  return (
    <ReferenceArrayFieldBase
      filter={filter}
      page={page}
      perPage={perPage}
      reference={reference}
      resource={resource}
      sort={sort}
      source={source}
      queryOptions={queryOptions}
      render={render}
    >
      <PureReferenceArrayFieldView {...rest} />
    </ReferenceArrayFieldBase>
  );
};
export interface ReferenceArrayFieldProps<
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
> extends ReferenceArrayFieldViewProps {
  filter?: FilterPayload;
  page?: number;
  pagination?: ReactElement;
  perPage?: number;
  reference: string;
  resource?: string;
  source: NoInfer<HintedString<ExtractRecordPaths<RecordType>>>;
  sort?: SortPayload;
  queryOptions?: Omit<
    UseQueryOptions<ReferenceRecordType[], Error>,
    "queryFn" | "queryKey"
  >;
  render?: (props: ListControllerResult<ReferenceRecordType>) => ReactElement;
}

export interface ReferenceArrayFieldViewProps {
  children?: ReactNode;
  className?: string;
  empty?: ReactNode;
  error?: ReactNode;
  loading?: ReactNode;
  pagination?: ReactNode;
}

export const ReferenceArrayFieldView = (
  props: ReferenceArrayFieldViewProps,
) => {
  const {
    children = defaultChildren,
    className,
    empty,
    error: errorElement,
    loading,
    pagination,
  } = props;
  const {
    isPending,
    error,
    total,
    hasPreviousPage,
    hasNextPage,
    data,
    filterValues,
  } = useListContext();

  return (
    <div className={className}>
      {isPending && loading !== false ? (
        loading
      ) : error && errorElement !== false ? (
        errorElement
      ) : (total === 0 ||
          (total == null &&
            hasPreviousPage === false &&
            hasNextPage === false &&
            // @ts-expect-error FIXME total may be undefined when using partial pagination but the ListControllerResult type is wrong about it
            data.length === 0 &&
            // the user didn't set any filters
            !Object.keys(filterValues).length)) &&
        empty !== false ? (
        empty
      ) : (
        <span>
          {children}
          {pagination && total !== undefined ? pagination : null}
        </span>
      )}
    </div>
  );
};

const defaultChildren = <SingleFieldList />;
const PureReferenceArrayFieldView = memo(ReferenceArrayFieldView);

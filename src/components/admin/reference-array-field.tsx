import { memo, type ReactElement, type ReactNode } from "react";
import {
  ExtractRecordPaths,
  HintedString,
  ReferenceArrayFieldBase,
  useListContext,
  type FilterPayload,
  type ListControllerResult,
  type RaRecord,
  type SortPayload,
} from "ra-core";
import type { UseQueryOptions } from "@tanstack/react-query";
import { SingleFieldList } from "@/components/admin/single-field-list";

/**
 * A container component that fetches records from another resource specified
 * by an array of *ids* in current record.
 *
 * You must define the fields to be passed to the iterator component as children.
 *
 * @example Display all the categories of the current product as a list of chips (the default)
 * // product = {
 * //   id: 456,
 * //   category_ids: [11, 22, 33],
 * // }
 * <ReferenceArrayField label="Categories" reference="categories" source="category_ids"/ >
 *
 * @example Display all the products of the current order as DataTable
 * // order = {
 * //   id: 123,
 * //   product_ids: [456, 457, 458],
 * // }
 * <ReferenceArrayField label="Products" reference="products" source="product_ids">
 *     <DataTable>
 *         <DataTable.Col source="id" />
 *         <DataTable.Col source="description" />
 *         <DataTable.NumberCol source="price" options={{ style: 'currency', currency: 'USD' }} />
 *         <DataTable.Col><EditButton /></DataTable.Col>
 *     </DataTable>
 * </ReferenceArrayField>
 *
 * By default, restricts the displayed values to 1000. You can extend this limit
 * by setting the `perPage` prop.
 *
 * @example
 * <ReferenceArrayField perPage={10} reference="categories" source="category_ids">
 *    ...
 * </ReferenceArrayField>
 *
 * By default, the field displays the results in the order in which they are referenced
 * (i.e. in the order of the list of ids). You can change this order
 * by setting the `sort` prop (an object with `field` and `order` properties).
 *
 * @example
 * <ReferenceArrayField sort={{ field: 'name', order: 'ASC' }} reference="categories" source="category_ids">
 *    ...
 * </ReferenceArrayField>
 *
 * Also, you can filter the results to display only a subset of values. Use the
 * `filter` prop for that.
 *
 * @example
 * <ReferenceArrayField filter={{ is_published: true }} reference="categories" source="category_ids">
 *    ...
 * </ReferenceArrayField>
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

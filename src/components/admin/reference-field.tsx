import type {
  ExtractRecordPaths,
  LinkToType,
  RaRecord,
  UseReferenceFieldControllerResult,
} from "ra-core";
import {
  ReferenceFieldBase,
  useFieldValue,
  useGetRecordRepresentation,
  useReferenceFieldContext,
  useTranslate,
} from "ra-core";
import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router";
import type { UseQueryOptions } from "@tanstack/react-query";

/**
 * Displays a field from a related record by following a foreign key relationship.
 *
 * This field fetches the related record using the foreign key value and displays it using the record representation.
 * It supports linking to the related record's show or edit page.
 * To be used with RecordField or DataTable.Col components, or anywhere a RecordContext is available.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/referencefield/ ReferenceField documentation}
 *
 * @example
 * import { List, DataTable, ReferenceField } from '@/components/admin';
 *
 * const PostList = () => (
 *   <List>
 *     <DataTable>
 *       <DataTable.Col source="title" />
 *       <DataTable.Col label="Author">
 *         <ReferenceField source="author_id" reference="authors" link="show" />
 *       </DataTable.Col>
 *     </DataTable>
 *   </List>
 * );
 */
export const ReferenceField = <
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
>(
  props: ReferenceFieldProps<RecordType, ReferenceRecordType>,
) => {
  const { loading, error, empty, render, ...rest } = props;
  const id = useFieldValue<RecordType>(props);
  const translate = useTranslate();

  return id == null ? (
    typeof empty === "string" ? (
      <>{empty && translate(empty, { _: empty })}</>
    ) : (
      empty
    )
  ) : (
    <ReferenceFieldBase {...rest}>
      <ReferenceFieldView<ReferenceRecordType>
        render={render}
        loading={loading}
        error={error}
        {...rest}
      />
    </ReferenceFieldBase>
  );
};

export interface ReferenceFieldProps<
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
> extends Partial<ReferenceFieldViewProps<ReferenceRecordType>> {
  children?: ReactNode;
  queryOptions?: UseQueryOptions<RaRecord[], Error> & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    meta?: any;
  };
  record?: RecordType;
  reference: string;
  translateChoice?: ((record: ReferenceRecordType) => string) | boolean;
  link?: LinkToType;
  source: ExtractRecordPaths<RecordType>;
}

// useful to prevent click bubbling in a datagrid with rowClick
const stopPropagation = (e: MouseEvent<HTMLAnchorElement>) =>
  e.stopPropagation();

export const ReferenceFieldView = <
  ReferenceRecordType extends RaRecord = RaRecord,
>(
  props: ReferenceFieldViewProps<ReferenceRecordType>,
) => {
  const {
    children,
    className,
    empty,
    error: errorElement,
    render,
    reference,
    loading,
  } = props;
  const referenceFieldContext = useReferenceFieldContext();
  const { error, link, isPending, referenceRecord } = referenceFieldContext;
  const getRecordRepresentation = useGetRecordRepresentation(reference);
  const translate = useTranslate();

  if (error && errorElement !== false) {
    return errorElement;
  }
  if (isPending && loading !== false) {
    return loading;
  }
  if (!referenceRecord && empty !== false) {
    return typeof empty === "string" ? (
      <>{empty && translate(empty, { _: empty })}</>
    ) : (
      empty
    );
  }

  const child = render
    ? render(referenceFieldContext)
    : children || <span>{getRecordRepresentation(referenceRecord)}</span>;

  if (link) {
    return (
      <span className={className}>
        <Link to={link} onClick={stopPropagation}>
          {child}
        </Link>
      </span>
    );
  }

  return <>{child}</>;
};

export interface ReferenceFieldViewProps<
  ReferenceRecordType extends RaRecord = RaRecord,
> {
  children?: ReactNode;
  className?: string;
  empty?: ReactNode;
  loading?: ReactNode;
  render?: (props: UseReferenceFieldControllerResult) => ReactNode;
  reference: string;
  source: string;
  resource?: string;
  translateChoice?: ((record: ReferenceRecordType) => string) | boolean;
  resourceLinkPath?: LinkToType;
  error?: ReactNode;
}

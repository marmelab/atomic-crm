import type { RaRecord, SortPayload } from "ra-core";
import {
  useCreatePath,
  useRecordContext,
  useReferenceManyFieldController,
} from "ra-core";
import { Link } from "react-router";

/**
 * Displays the count of related records that reference the current record.
 *
 * Calls dataProvider.getList() to compute the the number of records in a related resource that have a foreign key pointing to the current record.
 * It can optionally link to a filtered list of those records.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/referencemanycount/ ReferenceManyCount documentation}
 *
 * @example
 * import { List, DataTable, ReferenceManyCount } from '@/components/admin';
 *
 * const AuthorList = () => (
 *   <List>
 *     <DataTable>
 *       <DataTable.Col source="name" />
 *       <DataTable.Col label="Number of Books">
 *         <ReferenceManyCount reference="books" target="author_id" link />
 *       </DataTable.Col>
 *     </DataTable>
 *   </List>
 * );
 */
export const ReferenceManyCount = <RecordType extends RaRecord = RaRecord>(
  props: ReferenceManyCountProps<RecordType>,
) => {
  const {
    reference,
    target,
    filter,
    sort,
    link,
    resource,
    source = "id",
  } = props;
  const record = useRecordContext<RecordType>(props);
  const createPath = useCreatePath();

  const { isLoading, error, total } =
    useReferenceManyFieldController<RecordType>({
      filter,
      sort,
      page: 1,
      perPage: 1,
      record,
      reference,
      resource,
      source,
      target,
    });

  const body = isLoading ? "" : error ? "error" : total;

  return link && record ? (
    <Link
      to={{
        pathname: createPath({ resource: reference, type: "list" }),
        search: `filter=${JSON.stringify({
          ...(filter || {}),
          [target]: record[source],
        })}`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {body}
    </Link>
  ) : (
    <span>{body}</span>
  );
};

export interface ReferenceManyCountProps<
  RecordType extends RaRecord = RaRecord,
> {
  record?: RecordType;
  reference: string;
  resource?: string;
  target: string;
  source?: string;
  sort?: SortPayload;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: any;
  link?: boolean;
  timeout?: number;
}

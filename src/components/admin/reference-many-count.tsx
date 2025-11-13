import type { RaRecord, SortPayload } from "ra-core";
import {
  useCreatePath,
  useRecordContext,
  useReferenceManyFieldController,
} from "ra-core";
import { Link } from "react-router";

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

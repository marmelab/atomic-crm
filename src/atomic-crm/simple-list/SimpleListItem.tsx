import type { Identifier, LinkToType, RaRecord } from "ra-core";
import {
  useEvent,
  useGetPathForRecord,
  useGetPathForRecordCallback,
  useRecordContext,
  useResourceContext,
} from "ra-core";
import type { ReactElement, ReactNode } from "react";
import { Link, useNavigate } from "react-router";

export const SimpleListItem = <RecordType extends RaRecord = any>(
  props: SimpleListItemProps<RecordType>,
) => {
  const { children, linkType, rowClick, style } = props;
  const resource = useResourceContext(props);
  const record = useRecordContext<RecordType>(props);
  const navigate = useNavigate();
  // If we don't have a function to get the path, we can compute the path immediately and set the href
  // on the Link correctly without onClick (better for accessibility)
  const isFunctionLink =
    typeof linkType === "function" || typeof rowClick === "function";
  const pathForRecord = useGetPathForRecord({
    link: isFunctionLink ? false : (linkType ?? rowClick),
    resource,
  });
  const getPathForRecord = useGetPathForRecordCallback();
  const handleClick = useEvent(async () => {
    // No need to handle non function linkType or rowClick
    if (!isFunctionLink) return;
    if (!record) return;

    const link: LinkToType =
      typeof linkType === "function"
        ? linkType(record, record.id)
        : typeof rowClick === "function"
          ? (record, resource) => rowClick(record.id, resource, record)
          : false;

    const path = await getPathForRecord({
      record,
      resource,
      link,
    });
    if (path === false || path == null) {
      return;
    }
    navigate(path);
  });

  if (!record) return null;

  if (isFunctionLink) {
    return (
      <li className="w-full">
        <button
          onClick={handleClick}
          style={style}
          className="w-full text-left hover:bg-muted focus: bg-muted focus:outline-none"
        >
          {children}
        </button>
      </li>
    );
  }

  if (pathForRecord) {
    return (
      <li className="w-full">
        <Link
          to={pathForRecord}
          style={style}
          className="block w-full hover:bg-muted focus:bg-muted focus:outline-none"
        >
          {children}
        </Link>
      </li>
    );
  }

  return <li className="w-full">{children}</li>;
};

export type FunctionToElement<RecordType extends RaRecord = any> = (
  record: RecordType,
  id: Identifier,
) => ReactNode;

export type FunctionLinkType = (record: RaRecord, id: Identifier) => string;

export interface SimpleListBaseProps<RecordType extends RaRecord = any> {
  leftAvatar?: FunctionToElement<RecordType>;
  leftIcon?: FunctionToElement<RecordType>;
  primaryText?: FunctionToElement<RecordType> | ReactElement | string;
  /**
   * @deprecated use rowClick instead
   */
  linkType?: string | FunctionLinkType | false;

  /**
   * The action to trigger when the user clicks on a row.
   *
   * @see https://marmelab.com/shadcn-admin-kit/docs/datatable/
   * @example
   * import { List, DataTable } from 'shadcn-admin-kit';
   *
   * export const PostList = () => (
   *     <List>
   *         <DataTable rowClick="edit">
   *             ...
   *         </DataTable>                    </ListItem>

   *     </List>
   * );
   */
  rowClick?: string | RowClickFunction | false;
  rightAvatar?: FunctionToElement<RecordType>;
  rightIcon?: FunctionToElement<RecordType>;
  secondaryText?: FunctionToElement<RecordType> | ReactElement | string;
  tertiaryText?: FunctionToElement<RecordType> | ReactElement | string;
}

export interface SimpleListItemProps<RecordType extends RaRecord = any>
  extends SimpleListBaseProps<RecordType> {
  rowIndex: number;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  resource?: string;
}

export type RowClickFunction<RecordType extends RaRecord = RaRecord> = (
  id: Identifier,
  resource: string,
  record: RecordType,
) => string | false | Promise<string | false>;

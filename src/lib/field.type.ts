import type { BaseFieldProps } from "ra-core";
import type { ReactNode } from "react";

export interface FieldProps<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends Record<string, any> = Record<string, any>,
> extends Omit<BaseFieldProps<RecordType>, "resource"> {
  /**
   * The component to display when the field value is empty. Defaults to empty string.
   *
   * @example
   * const PostList = () => (
   *     <List>
   *         <DataTable>
   *             <TextField source="title" />
   *             <TextField source="author" empty="missing data" />
   *         </DataTable>
   *     </List>
   * );
   */
  empty?: ReactNode;
}

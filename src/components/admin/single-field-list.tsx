import {
  RecordContextProvider,
  RecordRepresentation,
  useListContext,
} from "ra-core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Renders a horizontal list of records from a ListContext, displaying each as a badge.
 *
 * This component is used inside ArrayField, ReferenceArrayField, or ReferenceManyField to display
 * records in a compact inline format. By default, it renders each record with its record representation.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/singlefieldlist/ SingleFieldList documentation}
 *
 * @example
 * import {
 *     Show,
 *     RecordField,
 *     TextField,
 *     ReferenceArrayField,
 *     SingleFieldList,
 * } from '@/components/admin';
 *
 * const PostShow = () => (
 *     <Show>
 *       <div className="flex flex-col gap-4">
 *         <RecordField source="title" />
 *         <RecordField label="Tags">
 *           <ReferenceArrayField reference="tags" source="tag_ids">
 *             <SingleFieldList>
 *               <TextField source="name" />
 *             </SingleFieldList>
 *           </ReferenceArrayField>
 *         </RecordField>
 *       </div>
 *     </Show>
 * );
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SingleFieldList = <RecordType = any,>({
  children,
  render,
  className,
}: {
  children?: React.ReactNode;
  render?: (record: RecordType, index: number) => React.ReactNode;
  className?: string;
}) => {
  const { data } = useListContext();

  return (
    <div className={cn("flex gap-2", className)}>
      {data?.map((record, index) => (
        <RecordContextProvider key={index} value={record}>
          {render ? render(record, index) : children || <DefaultChildren />}
        </RecordContextProvider>
      ))}
    </div>
  );
};

const DefaultChildren = () => (
  <Badge variant="outline">
    <RecordRepresentation />
  </Badge>
);

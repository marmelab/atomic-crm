import { useRecordContext } from "ra-core";
import {
  ReferenceArrayField,
  type ReferenceArrayFieldProps,
} from "@/components/admin/reference-array-field";
import { SingleFieldList } from "@/components/admin/single-field-list";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ColoredBadge = (props: any) => {
  const record = useRecordContext();
  if (!record) return null;
  return (
    <Badge
      {...props}
      style={{ backgroundColor: record.color, border: 0 }}
      variant="outline"
      className={cn("text-black font-normal", props.className)}
    >
      {record.name}
    </Badge>
  );
};

// Cached contacts may still reference a deleted tag: don't notify about it.
// ra-core forwards onError to useGetManyAggregate, but its queryOptions type doesn't declare it.
const silentQueryOptions = {
  onError: () => {},
} as ReferenceArrayFieldProps["queryOptions"];

export const TagsList = () => (
  <ReferenceArrayField
    className="inline-block"
    resource="contacts"
    source="tags"
    reference="tags"
    queryOptions={silentQueryOptions}
  >
    <SingleFieldList>
      <ColoredBadge source="name" />
    </SingleFieldList>
  </ReferenceArrayField>
);

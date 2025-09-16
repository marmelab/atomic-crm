import { ReferenceArrayField, SingleFieldList } from "@/components/admin";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRecordContext } from "ra-core";

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

export const TagsList = () => (
  <ReferenceArrayField
    className="inline-block"
    resource="contacts"
    source="tags"
    reference="tags"
  >
    <SingleFieldList>
      <ColoredBadge source="name" />
    </SingleFieldList>
  </ReferenceArrayField>
);

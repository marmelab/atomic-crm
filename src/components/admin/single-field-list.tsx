import {
  RecordContextProvider,
  RecordRepresentation,
  useListContext,
} from "ra-core";
import { Badge } from "@/components/ui/badge";

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
    <div className={`flex gap-2 ${className}`}>
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

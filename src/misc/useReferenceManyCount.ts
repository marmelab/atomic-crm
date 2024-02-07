import { RaRecord, useGetManyReference, useRecordContext } from "react-admin";

export const useReferenceManyCount = (props: {
  record?: RaRecord;
  reference: string;
  target: string;
}) => {
  const record = useRecordContext(props);
  const { total } = useGetManyReference(
    props.reference,
    {
      target: props.target,
      id: record?.id,
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "DESC" },
    },
    {
      enabled: !!record,
    }
  );

  return total ?? 0;
};

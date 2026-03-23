import type { Identifier } from "ra-core";
import { useGetManyAggregate } from "ra-core";

export const useGetSalesName = (
  id?: Identifier,
  options?: { enabled?: boolean },
) => {
  const enabled = options?.enabled ?? id != null;
  const { data, error } = useGetManyAggregate(
    "sales",
    { ids: id !== null ? [id] : undefined },
    { enabled },
  );

  return data && data[0]
    ? `${data[0].first_name} ${data[0].last_name}`
    : error
      ? "??"
      : "";
};

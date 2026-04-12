import {
  InfiniteListBase,
  useGetIdentity,
  useListContext,
} from "ra-core";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { InfinitePagination } from "../misc/InfinitePagination";
import type { Deal } from "../types";
import { DealCardContent } from "./DealCard";

export const DealListMobile = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <InfiniteListBase
      perPage={25}
      sort={{ field: "updated_at", order: "DESC" }}
      queryOptions={{
        onError: () => {
          /* Disable error notification as DealListLayoutMobile handles it */
        },
      }}
    >
      <DealListLayoutMobile />
    </InfiniteListBase>
  );
};

const DealListLayoutMobile = () => {
  const { isPending, data, error, filterValues } = useListContext<Deal>();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  return (
    <div>
      <MobileHeader>
        <h1 className="text-xl font-semibold">Deals</h1>
      </MobileHeader>
      <MobileContent>
        {!isPending && !data?.length && !hasFilters ? (
          <div className="py-6 text-sm text-muted-foreground">
            No deals yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data?.map((deal) => (
              <DealCardContent key={deal.id} deal={deal} />
            ))}
          </div>
        )}
        {!error && (
          <div className="flex justify-center">
            <InfinitePagination />
          </div>
        )}
      </MobileContent>
    </div>
  );
};

import * as React from "react";
const DealList = React.lazy(
  () => import("@/components/atomic-crm/deals/DealList"),
);

export default {
  list: DealList,
};

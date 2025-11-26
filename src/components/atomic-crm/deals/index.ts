import * as React from "react";

const DealList = React.lazy(() => import("./DealList"));
const DealEdit = React.lazy(() =>
  import("./DealEdit").then(({ DealEditPage }) => ({ default: DealEditPage })),
);
const DealShow = React.lazy(() =>
  import("./DealShow").then(({ DealShowPage }) => ({ default: DealShowPage })),
);
const DealCreate = React.lazy(() =>
  import("./DealCreate").then(({ DealCreatePage }) => ({
    default: DealCreatePage,
  })),
);

export default {
  list: DealList,
  edit: DealEdit,
  show: DealShow,
  create: DealCreate,
};

import React from "react";

const DealList = React.lazy(() => import("./DealList"));
const DealShow = React.lazy(() =>
  import("./DealShow").then((module) => ({ default: module.DealShow })),
);

export default {
  list: DealList,
  show: DealShow,
};

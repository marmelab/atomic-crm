import React from "react";

const ServiceContractList = React.lazy(() => import("./ServiceContractList"));
const ServiceContractCreate = React.lazy(
  () => import("./ServiceContractCreate"),
);
const ServiceContractEdit = React.lazy(() => import("./ServiceContractEdit"));
const ServiceContractShow = React.lazy(() => import("./ServiceContractShow"));

export default {
  list: ServiceContractList,
  create: ServiceContractCreate,
  edit: ServiceContractEdit,
  show: ServiceContractShow,
};

import React from "react";

const ProductList = React.lazy(() => import("./ProductList"));
const ProductCreate = React.lazy(() => import("./ProductCreate"));
const ProductEdit = React.lazy(() => import("./ProductEdit"));
const ProductShow = React.lazy(() => import("./ProductShow"));

export default {
  list: ProductList,
  create: ProductCreate,
  edit: ProductEdit,
  show: ProductShow,
};

import { lazyImportWithReload } from "@/lib/lazyImportWithReload";

const DealList = lazyImportWithReload(() => import("./DealList"), "DealList");

export default {
  list: DealList,
};

import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Package, ScanBarcode } from "lucide-react";

import { InventoryPage } from "./InventoryPage";

/** Stock on the phone settings screen: the catalog and the inventory count. */
export const MobileStockSection = () => {
  const translate = useTranslate();
  const rowClass =
    "flex min-h-12 w-full items-center gap-3 px-4 text-left text-base no-underline text-foreground";

  return (
    <section aria-labelledby="mobile-stock" className="flex flex-col gap-2">
      <h2
        id="mobile-stock"
        className="px-1 text-sm font-medium text-muted-foreground"
      >
        {translate("crm.nav.stock")}
      </h2>
      <div className="flex flex-col divide-y divide-border rounded-lg bg-card">
        <Link to={InventoryPage.path} className={rowClass}>
          <ScanBarcode className="size-5 text-muted-foreground" />
          {translate("crm.nav.inventory")}
        </Link>
        <Link to="/products" className={rowClass}>
          <Package className="size-5 text-muted-foreground" />
          {translate("resources.products.name", { smart_count: 2 })}
        </Link>
      </div>
    </section>
  );
};

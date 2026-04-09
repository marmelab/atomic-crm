import { useRecordContext } from "ra-core";
import { Show } from "@/components/admin/show";

import type { Product } from "../types";
import { formatPrice, getProductTypeLabel } from "./productUtils";

const ProductShowContent = () => {
  const record = useRecordContext<Product>();
  if (!record) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <span className="text-xs text-muted-foreground">Référence</span>
        <p className="text-sm">{record.reference}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Nom</span>
        <p className="text-sm">{record.name}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Type</span>
        <p className="text-sm">{getProductTypeLabel(record.type)}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Prix catalogue</span>
        <p className="text-sm">{formatPrice(record.price)}</p>
      </div>
      {record.description && (
        <div>
          <span className="text-xs text-muted-foreground">Description</span>
          <p className="text-sm whitespace-pre-line">{record.description}</p>
        </div>
      )}
    </div>
  );
};

const ProductShow = () => (
  <Show>
    <ProductShowContent />
  </Show>
);

export default ProductShow;

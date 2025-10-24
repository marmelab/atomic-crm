import { useGetIdentity, useRecordContext } from "ra-core";
import type { Sale } from "@/components/atomic-crm/types";

export const SaleName = ({ sale }: { sale?: Sale }) => {
  const { identity, isPending } = useGetIdentity();
  const saleFromContext = useRecordContext<Sale>();
  const finalSale = sale || saleFromContext;
  if (isPending || !finalSale) return null;
  return finalSale.id === identity?.id
    ? "You"
    : `${finalSale.first_name} ${finalSale.last_name}`;
};

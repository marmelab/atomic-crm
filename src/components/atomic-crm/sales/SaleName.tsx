import { useGetIdentity, useRecordContext, useTranslate } from "ra-core";

import type { Sale } from "../types";

export const SaleName = ({ sale }: { sale?: Sale }) => {
  const translate = useTranslate();
  const { identity, isPending } = useGetIdentity();
  const saleFromContext = useRecordContext<Sale>();
  const finalSale = sale || saleFromContext;
  if (isPending || !finalSale) return null;
  return finalSale.id === identity?.id
    ? translate("crm.common.you", { _: "You" })
    : `${finalSale.first_name} ${finalSale.last_name}`;
};

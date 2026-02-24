import { useGetIdentity, useRecordContext, useTranslate } from "ra-core";

import type { Sale } from "../types";

export const SaleName = ({ sale }: { sale?: Sale }) => {
  const { identity, isPending } = useGetIdentity();
  const translate = useTranslate();
  const saleFromContext = useRecordContext<Sale>();
  const finalSale = sale || saleFromContext;
  if (isPending || !finalSale) return null;
  return finalSale.id === identity?.id
    ? translate("crm.activity.you", { _: "You" })
    : `${finalSale.first_name} ${finalSale.last_name}`;
};

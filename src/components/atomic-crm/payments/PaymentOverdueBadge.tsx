import { toISODate } from "@/lib/dateTimezone";
import { useGetList } from "ra-core";

import { Badge } from "@/components/ui/badge";

import type { Payment } from "../types";

export const PaymentOverdueBadge = () => {
  const { total, isPending } = useGetList<Payment>("payments", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "payment_date", order: "ASC" },
    filter: {
      "status@neq": "ricevuto",
      "payment_date@lt": toISODate(new Date()),
    },
  });

  if (isPending || !total || total <= 0) {
    return null;
  }

  return (
    <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-[10px]">
      {total}
    </Badge>
  );
};

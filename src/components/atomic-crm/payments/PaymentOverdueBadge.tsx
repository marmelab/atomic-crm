import { useGetList } from "ra-core";

import { Badge } from "@/components/ui/badge";

import type { Payment } from "../types";

const toLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const PaymentOverdueBadge = () => {
  const { total, isPending } = useGetList<Payment>("payments", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "payment_date", order: "ASC" },
    filter: {
      "status@neq": "ricevuto",
      "payment_date@lt": toLocalISODate(new Date()),
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

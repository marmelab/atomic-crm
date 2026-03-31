import { formatBusinessDate } from "@/lib/dateTimezone";
import { type Identifier } from "ra-core";

import type { Client } from "../types";

export const formatShortDate = (value?: string | null) => {
  if (!value) return "--";
  return (
    formatBusinessDate(
      value,
      {
        day: "2-digit",
        month: "2-digit",
      },
      "it-IT",
    ) || "--"
  );
};

export const formatFullCurrency = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

export const getClientName = (
  clientsById: Map<string, Client>,
  clientId?: Identifier | null,
) => {
  if (!clientId) return "Cliente";
  return clientsById.get(String(clientId))?.name ?? "Cliente";
};

export const prettifyServiceType = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

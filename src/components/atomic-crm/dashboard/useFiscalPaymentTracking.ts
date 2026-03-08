import { useCallback, useMemo } from "react";
import { useStore } from "ra-core";

import type { FiscalDeadline } from "./fiscalModelTypes";

export type FiscalPaymentRecord = {
  /** Deadline identifier: "YYYY-MM-DD::label" */
  key: string;
  paidAmount: number;
  paidDate: string;
};

type FiscalPaymentStore = Record<string, FiscalPaymentRecord>;

const makeKey = (deadline: FiscalDeadline) =>
  `${deadline.date}::${deadline.label}`;

export const useFiscalPaymentTracking = (year: number) => {
  const storeKey = `dashboard.fiscalPayments.${year}`;
  const [store, setStore] = useStore<FiscalPaymentStore>(storeKey, {});

  const markAsPaid = useCallback(
    (deadline: FiscalDeadline, paidAmount: number, paidDate: string) => {
      const key = makeKey(deadline);
      setStore((prev) => ({
        ...prev,
        [key]: { key, paidAmount, paidDate },
      }));
    },
    [setStore],
  );

  const clearPayment = useCallback(
    (deadline: FiscalDeadline) => {
      const key = makeKey(deadline);
      setStore((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [setStore],
  );

  const getPayment = useCallback(
    (deadline: FiscalDeadline): FiscalPaymentRecord | null => {
      return store[makeKey(deadline)] ?? null;
    },
    [store],
  );

  const totalPaid = useMemo(
    () => Object.values(store).reduce((sum, r) => sum + r.paidAmount, 0),
    [store],
  );

  return { markAsPaid, clearPayment, getPayment, totalPaid };
};

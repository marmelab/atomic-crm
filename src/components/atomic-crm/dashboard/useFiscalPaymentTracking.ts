import { useCallback, useEffect } from "react";
import { useStore } from "ra-core";

import { buildFiscalDeadlineKey } from "./buildFiscalDeadlineKey";
import type { FiscalDeadline } from "./fiscalModelTypes";

export type FiscalPaymentRecord = {
  /** Stable deadline identifier derived from fiscal invariants. */
  key: string;
  paidAmount: number;
  paidDate: string;
};

type FiscalPaymentStore = Record<string, FiscalPaymentRecord>;

const makeKey = (deadline: FiscalDeadline) => buildFiscalDeadlineKey(deadline);

export const useFiscalPaymentTracking = (year: number) => {
  const storeKey = `dashboard.fiscalPayments.${year}`;
  const [store, setStore] = useStore<FiscalPaymentStore>(storeKey, {});
  const hasLegacyKeyShape = Object.keys(store).some((key) =>
    key.includes("::"),
  );

  useEffect(() => {
    if (hasLegacyKeyShape) {
      setStore({});
    }
  }, [hasLegacyKeyShape, setStore]);

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

  return { markAsPaid, clearPayment, getPayment };
};

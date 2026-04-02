import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import type { CrmDataProvider } from "../providers/types";
import type { FiscalDeadline } from "./fiscalModelTypes";
import type {
  FiscalDeadlineView,
  FiscalObligation,
  FiscalF24PaymentLineEnriched,
} from "./fiscalRealityTypes";
import { buildFiscalRealityAwareSchedule } from "./buildFiscalRealityAwareSchedule";

// ── Types ────────────────────────────────────────────────────────────────────

type UseFiscalRealityInput = {
  estimatedDeadlines: FiscalDeadline[];
  paymentYear: number;
  todayIso: string;
};

type UseFiscalRealityResult = {
  deadlineViews: FiscalDeadlineView[] | null;
  obligations: FiscalObligation[];
  enrichedPaymentLines: FiscalF24PaymentLineEnriched[];
  totalOpenObligations: number;
  hasRealFiscalData: boolean;
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useFiscalReality = ({
  estimatedDeadlines,
  paymentYear,
  todayIso,
}: UseFiscalRealityInput): UseFiscalRealityResult => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { data: obligations, isPending: obligationsPending } = useQuery({
    queryKey: ["fiscal-obligations", paymentYear],
    queryFn: () => dataProvider.getFiscalObligations(paymentYear),
  });

  const { data: enrichedPaymentLines, isPending: paymentLinesPending } =
    useQuery({
      queryKey: ["fiscal-enriched-payment-lines", paymentYear],
      queryFn: () => dataProvider.getEnrichedPaymentLinesForYear(paymentYear),
    });

  const isLoading = obligationsPending || paymentLinesPending;

  const deadlineViews = useMemo<FiscalDeadlineView[] | null>(() => {
    if (isLoading || obligations == null || enrichedPaymentLines == null) {
      return null;
    }

    return buildFiscalRealityAwareSchedule({
      estimatedDeadlines,
      obligations,
      enrichedPaymentLines,
      todayIso,
    });
  }, [estimatedDeadlines, obligations, enrichedPaymentLines, todayIso, isLoading]);

  const resolvedObligations = obligations ?? [];
  const resolvedPaymentLines = enrichedPaymentLines ?? [];

  const totalOpenObligations = useMemo(() => {
    if (deadlineViews == null) return 0;
    return deadlineViews.reduce((sum, view) => {
      return (
        sum + view.items.reduce((s, item) => s + item.remainingAmount, 0)
      );
    }, 0);
  }, [deadlineViews]);

  const hasRealFiscalData = resolvedObligations.length > 0;

  return {
    deadlineViews,
    obligations: resolvedObligations,
    enrichedPaymentLines: resolvedPaymentLines,
    totalOpenObligations,
    hasRealFiscalData,
  };
};

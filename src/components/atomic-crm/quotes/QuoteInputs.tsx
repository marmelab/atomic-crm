import { useGetOne } from "ra-core";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Separator } from "@/components/ui/separator";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Project, QuoteItem } from "../types";
import { computeQuoteItemsTotal, hasQuoteItems } from "./quoteItems";
import { QuoteIdentityInputs } from "./inputs/QuoteIdentityInputs";
import { QuoteItemsInputs } from "./inputs/QuoteItemsInputs";
import { QuoteStatusInputs } from "./inputs/QuoteStatusInputs";
import { QuoteNotesInputs } from "./inputs/QuoteNotesInputs";

const toIdString = (value: unknown) =>
  value == null || value === "" ? null : String(value);

export const QuoteInputs = () => {
  const clientId = useWatch({ name: "client_id" });
  const projectId = useWatch({ name: "project_id" });
  const amount = useWatch({ name: "amount" });
  const recordId = toIdString(useWatch({ name: "id" }));
  const currentTaxable = useWatch({ name: "is_taxable" });
  const quoteItems = useWatch({ name: "quote_items" }) as
    | QuoteItem[]
    | undefined;
  const { setValue, getFieldState } = useFormContext();
  const { fiscalConfig } = useConfigurationContext();
  const { data: selectedProject } = useGetOne<Project>(
    "projects",
    { id: projectId },
    { enabled: !!projectId },
  );

  const itemizedQuote = hasQuoteItems(quoteItems);
  const itemizedAmount = computeQuoteItemsTotal(quoteItems);
  const selectedClientId = toIdString(clientId);
  const taxabilityDefaults = fiscalConfig?.taxabilityDefaults;
  const suggestedTaxable =
    selectedProject &&
    taxabilityDefaults?.nonTaxableCategories?.includes(selectedProject.category)
      ? false
      : selectedClientId &&
          taxabilityDefaults?.nonTaxableClientIds?.includes(selectedClientId)
        ? false
        : true;

  // Auto-sync client_id when project is selected
  useEffect(() => {
    if (!selectedProject) return;
    if (String(clientId ?? "") === String(selectedProject.client_id ?? "")) {
      return;
    }
    setValue("client_id", selectedProject.client_id, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [clientId, selectedProject, setValue]);

  // Auto-calculate amount from quote items
  useEffect(() => {
    if (!itemizedQuote) return;
    if (Number(amount ?? 0) === itemizedAmount) return;
    setValue("amount", itemizedAmount, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [amount, itemizedAmount, itemizedQuote, setValue]);

  // Auto-suggest taxability on create
  useEffect(() => {
    if (recordId) return;
    const isDirty = getFieldState("is_taxable").isDirty;
    if (isDirty || currentTaxable === suggestedTaxable) return;
    setValue("is_taxable", suggestedTaxable, {
      shouldDirty: false,
      shouldValidate: false,
      shouldTouch: false,
    });
  }, [
    currentTaxable,
    recordId,
    setValue,
    suggestedTaxable,
    // Intentionally NOT depending on formState/getFieldState to avoid cycles
  ]);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Left column: Identity + Items */}
      <div className="flex-1 flex flex-col gap-6">
        <QuoteIdentityInputs />
        <Separator />
        <QuoteItemsInputs />
      </div>

      {/* Vertical separator on desktop */}
      <Separator orientation="vertical" className="hidden md:block self-stretch" />

      {/* Right column: Status + Notes */}
      <div className="flex-1 flex flex-col gap-6">
        <QuoteStatusInputs suggestedTaxable={suggestedTaxable} />
        <Separator />
        <QuoteNotesInputs />
      </div>
    </div>
  );
};

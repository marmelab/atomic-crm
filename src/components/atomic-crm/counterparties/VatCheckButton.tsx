import { useState } from "react";
import { useDataProvider, useTranslate } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { BadgeCheck, CircleHelp, CircleX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import type { Requisites } from "../business/types";
import type { CrmDataProvider } from "../providers/types";
import { isEuCountry } from "./counterpartyOptions";
import type { VatStatus } from "./types";

const FILLED_FIELDS = ["name", "address", "zipcode", "city"] as const;

/**
 * "Fill in by VAT": checks the VAT number with VIES and fills the empty name
 * and address fields of the counterparty (TZ section 5.1). A Polish
 * counterparty uses its NIP, others their VAT ID.
 */
export const VatCheckButton = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { getValues, setValue } = useFormContext();
  const countryCode = useWatch({ name: "country_code" }) as string | null;
  const requisites = useWatch({ name: "requisites" }) as Requisites | undefined;
  const vatId = useWatch({ name: "vat_id" }) as string | null;
  const status = useWatch({ name: "vat_status" }) as VatStatus | null;
  const [isChecking, setIsChecking] = useState(false);

  const number = (requisites?.nip || vatId || "").trim();
  if (!isEuCountry(countryCode)) return null;

  const check = async () => {
    if (!countryCode || !number) return;
    setIsChecking(true);
    try {
      const result = await dataProvider.checkVat(countryCode, number);
      setValue("vat_status", result.status, { shouldDirty: true });
      setValue("vat_checked_at", new Date().toISOString(), {
        shouldDirty: true,
      });
      if (result.status !== "valid") return;
      setValue("vat_id", result.vatId, { shouldDirty: true });
      for (const field of FILLED_FIELDS) {
        const found = result[field];
        if (found && !String(getValues(field) ?? "").trim()) {
          setValue(field, found, { shouldDirty: true, shouldValidate: true });
        }
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        onClick={check}
        disabled={!number || isChecking}
        className="self-start"
      >
        {isChecking ? <Spinner /> : <Search />}
        {translate("crm.counterparty.vat_check")}
      </Button>
      {status ? <VatStatusLine status={status} /> : null}
    </div>
  );
};

export const VatStatusLine = ({ status }: { status: VatStatus }) => {
  const translate = useTranslate();
  const Icon =
    status === "valid"
      ? BadgeCheck
      : status === "invalid"
        ? CircleX
        : CircleHelp;
  const color =
    status === "valid"
      ? "text-primary"
      : status === "invalid"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <p role="status" className={`flex items-center gap-1.5 text-sm ${color}`}>
      <Icon className="size-4" />
      {translate(`crm.counterparty.vat_status.${status}`)}
    </p>
  );
};

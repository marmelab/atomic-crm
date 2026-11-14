import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  useCreatePath,
  useDataProvider,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { useWatch } from "react-hook-form";
import { Link } from "react-router";
import { TriangleAlert } from "lucide-react";

import type { Requisites } from "../business/types";
import type { CrmDataProvider } from "../providers/types";
import type { Company } from "../types";

const DEBOUNCE_MS = 400;

const useDebounced = <T,>(value: T): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
};

/**
 * Warns while typing that a counterparty with the same tax number, IBAN or
 * VAT ID already exists, with a link to it (TZ section 5.1).
 */
export const DuplicateWarning = () => {
  const translate = useTranslate();
  const createPath = useCreatePath();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const record = useRecordContext<Company>();
  const requisites = useWatch({ name: "requisites" }) as Requisites | undefined;
  const vatId = useWatch({ name: "vat_id" }) as string | undefined;
  const key = useDebounced(JSON.stringify([requisites ?? {}, vatId ?? ""]));

  const [debouncedRequisites, debouncedVatId] = JSON.parse(key) as [
    Requisites,
    string,
  ];
  const hasValue =
    Object.values(debouncedRequisites).some((value) => value?.trim()) ||
    !!debouncedVatId.trim();

  const { data: duplicates = [] } = useQuery({
    queryKey: ["company_duplicates", record?.id, key],
    queryFn: () =>
      dataProvider.findCompanyDuplicates(
        record?.id,
        debouncedRequisites,
        debouncedVatId,
      ),
    enabled: hasValue,
  });

  if (!hasValue || duplicates.length === 0) return null;

  const unique = duplicates.filter(
    (item, index) => duplicates.findIndex((d) => d.id === item.id) === index,
  );

  return (
    <div
      role="status"
      className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        <span>{translate("crm.counterparty.duplicate")}</span>
        {unique.map((duplicate) => (
          <Link
            key={duplicate.id}
            to={createPath({
              resource: "companies",
              id: duplicate.id,
              type: "show",
            })}
            className="font-medium underline"
          >
            {duplicate.name}
          </Link>
        ))}
      </div>
    </div>
  );
};

import { useLocaleState, useTranslate } from "ra-core";
import { Badge } from "@/components/ui/badge";

import { AsideSection } from "../misc/AsideSection";
import { formatMoney } from "../money/money";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company } from "../types";
import { countryName } from "./counterpartyOptions";
import { VatStatusLine } from "./VatCheckButton";

/** Roles as small badges: "Клієнт", "Постачальник". */
export const RoleBadges = ({ roles }: { roles?: string[] | null }) => {
  const translate = useTranslate();
  if (!roles?.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {roles.map((role) => (
        <Badge key={role} variant="secondary" className="font-normal">
          {translate(`crm.counterparty.roles.${role}`)}
        </Badge>
      ))}
    </div>
  );
};

/** Kind, roles, country, requisites and terms on the counterparty page. */
export const CounterpartyInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  const [uiLocale = "uk"] = useLocaleState();
  const { currency: businessCurrency, locale } = useConfigurationContext();
  const requisites = Object.entries(record.requisites ?? {});
  const currency = record.currency || businessCurrency;

  return (
    <AsideSection title={translate("crm.counterparty.title")}>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          <span>
            {translate(`crm.counterparty.kinds.${record.kind ?? "company"}`)}
          </span>
          {record.country_code ? (
            <span className="text-muted-foreground">
              · {countryName(record.country_code, uiLocale)}
            </span>
          ) : null}
        </div>
        <div className="[&>div]:justify-start">
          <RoleBadges roles={record.roles} />
        </div>
        {requisites.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-2">
            <span className="text-muted-foreground">
              {translate(`crm.requisites.${key}`, { _: key })}
            </span>
            <span className="font-mono break-all text-right">{value}</span>
          </div>
        ))}
        {record.vat_id ? (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">VAT ID</span>
            <span className="font-mono">{record.vat_id}</span>
          </div>
        ) : null}
        {record.tax_identifier ? (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">
              {translate("resources.companies.fields.tax_identifier")}
            </span>
            <span className="font-mono">{record.tax_identifier}</span>
          </div>
        ) : null}
        {record.vat_status ? (
          <VatStatusLine status={record.vat_status} />
        ) : null}
        {record.payment_terms_days != null ? (
          <div>
            {translate("crm.counterparty.payment_terms", {
              smart_count: record.payment_terms_days,
            })}
          </div>
        ) : null}
        {record.credit_limit != null ? (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">
              {translate("resources.companies.fields.credit_limit")}
            </span>
            <span>{formatMoney(record.credit_limit, currency, locale)}</span>
          </div>
        ) : null}
      </div>
    </AsideSection>
  );
};

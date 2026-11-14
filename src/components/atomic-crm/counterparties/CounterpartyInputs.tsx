import { useQuery } from "@tanstack/react-query";
import {
  useDataProvider,
  useInput,
  useLocaleState,
  useTranslate,
} from "ra-core";
import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { NumberInput } from "@/components/admin/number-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { RequisiteFields } from "../business/RequisiteFields";
import { findInvalidRequisites } from "../business/requisiteRules";
import type { RequisiteField, Requisites } from "../business/types";
import { MoneyInput } from "../money/MoneyInput";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  COUNTERPARTY_KINDS,
  COUNTERPARTY_ROLES,
  TERMS_CURRENCIES,
  countryChoices,
  type CounterpartyRole,
} from "./counterpartyOptions";
import { DuplicateWarning } from "./DuplicateWarning";
import { VatCheckButton } from "./VatCheckButton";

/** Kind, roles, country and requisites of a counterparty (TZ section 5.1). */
export const CounterpartyIdentityInputs = () => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const countryCode = useWatch({ name: "country_code" }) as string | null;
  const fields = useRequisiteFields(countryCode);
  const hasPack = fields.length > 0;
  useClearRequisitesOnCountryChange(countryCode);

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("crm.counterparty.title")}
      </h6>
      <RadioButtonGroupInput
        source="kind"
        choices={COUNTERPARTY_KINDS.map((kind) => ({
          id: kind,
          name: translate(`crm.counterparty.kinds.${kind}`),
        }))}
        row
        helperText={false}
      />
      <RolesInput />
      <SelectInput
        source="country_code"
        choices={countryChoices(locale)}
        helperText={false}
        emptyText={translate("crm.counterparty.no_country")}
      />
      {hasPack ? <RequisitesInput fields={fields} /> : null}
      {countryCode && !hasPack ? (
        <>
          <div className="flex items-start gap-2">
            <TextInput
              source="vat_id"
              helperText={false}
              className="flex-1"
              placeholder="DE123456789"
            />
            <VatCheckButton />
          </div>
          <TextInput source="tax_identifier" helperText={false} />
        </>
      ) : null}
      <DuplicateWarning />
    </div>
  );
};

/** Currency, payment delay and credit limit of a counterparty. */
export const CounterpartyTermsInputs = () => {
  const translate = useTranslate();
  const { currency: businessCurrency } = useConfigurationContext();
  const currency =
    (useWatch({ name: "currency" }) as string | null) || businessCurrency;
  const currencies = Array.from(
    new Set([businessCurrency, ...TERMS_CURRENCIES]),
  );

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("crm.counterparty.terms")}
      </h6>
      <SelectInput
        source="currency"
        choices={currencies.map((code) => ({ id: code, name: code }))}
        helperText={false}
        emptyText={businessCurrency}
      />
      <NumberInput
        source="payment_terms_days"
        min={0}
        max={365}
        step={1}
        helperText={false}
      />
      <MoneyInput
        source="credit_limit"
        currency={currency}
        helperText={false}
      />
    </div>
  );
};

/**
 * Requisites belong to one country: picking another country empties them, so
 * a Ukrainian EDRPOU is never saved on a German counterparty.
 */
const useClearRequisitesOnCountryChange = (countryCode: string | null) => {
  const { setValue } = useFormContext();
  const previous = useRef(countryCode);
  useEffect(() => {
    if (previous.current === countryCode) return;
    previous.current = countryCode;
    setValue("requisites", {}, { shouldDirty: true });
    setValue("vat_status", null, { shouldDirty: true });
  }, [countryCode, setValue]);
};

/** The requisite fields of a country pack, none for a country without a pack. */
const useRequisiteFields = (
  countryCode: string | null | undefined,
): RequisiteField[] => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data } = useQuery({
    queryKey: ["requisite_fields", countryCode],
    queryFn: () => dataProvider.getRequisiteFields(countryCode as string),
    enabled: !!countryCode,
    staleTime: Infinity,
  });
  return countryCode ? (data ?? []) : [];
};

const RolesInput = () => {
  const translate = useTranslate();
  const { field, fieldState } = useInput<CounterpartyRole[]>({
    source: "roles",
    defaultValue: ["client"],
    validate: (value: CounterpartyRole[] | undefined) =>
      value && value.length > 0 ? undefined : "crm.counterparty.roles_required",
  });
  const roles: CounterpartyRole[] = field.value ?? [];
  const toggle = (role: CounterpartyRole, checked: boolean) =>
    field.onChange(
      checked ? [...roles, role] : roles.filter((item) => item !== role),
    );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">
        {translate("resources.companies.fields.roles")}
      </legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {COUNTERPARTY_ROLES.map((role) => (
          <Label key={role} className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={roles.includes(role)}
              onCheckedChange={(checked) => toggle(role, checked === true)}
            />
            {translate(`crm.counterparty.roles.${role}`)}
          </Label>
        ))}
      </div>
      {fieldState.error ? (
        <p className="text-sm text-destructive">
          {translate(fieldState.error.message ?? "")}
        </p>
      ) : null}
    </fieldset>
  );
};

const RequisitesInput = ({ fields }: { fields: RequisiteField[] }) => {
  const { field } = useInput<Requisites>({
    source: "requisites",
    defaultValue: {},
    validate: (value: Requisites | undefined) =>
      findInvalidRequisites(fields, value ?? {}).length > 0
        ? "crm.requisites.invalid"
        : undefined,
  });
  const value: Requisites = field.value ?? {};
  const known = new Set(fields.map((item) => item.key));

  return (
    <div className="flex flex-col gap-2">
      <RequisiteFields
        fields={fields}
        showRequired={false}
        value={value}
        onChange={(next) =>
          // Requisites of another country (the country was changed) are dropped
          field.onChange(
            Object.fromEntries(
              Object.entries(next).filter(([key]) => known.has(key)),
            ),
          )
        }
      />
      {fields.some((item) => item.validator === "nip") ? (
        <VatCheckButton />
      ) : null}
    </div>
  );
};

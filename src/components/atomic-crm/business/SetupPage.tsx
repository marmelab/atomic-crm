import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import {
  useDataProvider,
  useLogout,
  useNotify,
  useStoreContext,
  useTranslate,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notification } from "@/components/admin/notification";

import { reloadApp } from "./reloadApp";
import type { CrmDataProvider } from "../providers/types";
import { CONFIGURATION_STORE_KEY } from "../root/ConfigurationContext";
import { RequisiteFields } from "./RequisiteFields";
import {
  compactRequisites,
  findInvalidRequisites,
  findMissingRequisites,
} from "./requisiteRules";
import { BUSINESS_TYPES, type BusinessType, type Requisites } from "./types";

const BUSINESS_TYPE_HINTS: Record<BusinessType, string> = {
  services: "Salon, clinic, studio, car service",
  retail: "Shop, online store",
  production: "Workshop, distributor",
  b2b: "Agency, repairs, IT outsourcing",
};

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  services: "Services",
  retail: "Retail",
  production: "Small production and wholesale",
  b2b: "B2B services",
};

/**
 * The setup wizard: the first screen of a new account, and the way to add
 * another business. Currency, time zone and language come from the country.
 */
export const SetupPage = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const logout = useLogout();
  const store = useStoreContext();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("UA");
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [requisites, setRequisites] = useState<Requisites>({});

  const { data: packs = [] } = useQuery({
    queryKey: ["country_packs"],
    queryFn: () => dataProvider.getCountryPacks(),
  });
  const { data: fields = [] } = useQuery({
    queryKey: ["requisite_fields", countryCode],
    queryFn: () => dataProvider.getRequisiteFields(countryCode),
  });
  const { data: current } = useQuery({
    queryKey: ["businesses", "current-or-none"],
    queryFn: () => dataProvider.getCurrentBusiness(),
  });

  const pack = packs.find((p) => p.code === countryCode);
  const invalid = findInvalidRequisites(fields, requisites);
  const missing = findMissingRequisites(fields, requisites);
  const canSubmit =
    name.trim() !== "" &&
    businessType !== null &&
    invalid.length === 0 &&
    missing.length === 0;

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      dataProvider.createBusiness({
        name: name.trim(),
        country_code: countryCode,
        business_type: businessType!,
        requisites: compactRequisites(requisites),
      }),
    onSuccess: () => {
      store.removeItem(CONFIGURATION_STORE_KEY);
      reloadApp();
    },
    onError: (error: Error) => {
      notify(error.message, { type: "error" });
    },
  });

  const chooseCountry = (code: string) => {
    setCountryCode(code);
    setRequisites({});
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex max-w-xl flex-col gap-10 px-4 py-10 sm:py-16">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {current
              ? translate("crm.setup.title_another", {
                  _: "Add a business",
                })
              : translate("crm.setup.title", { _: "Set up your business" })}
          </h1>
          <p className="text-muted-foreground">
            {translate("crm.setup.intro", {
              _: "Three questions. Currency, time zone and document formats follow from the country.",
            })}
          </p>
        </header>

        <form
          className="flex flex-col gap-10"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) mutate();
          }}
        >
          <section className="flex flex-col gap-2">
            <Label htmlFor="business-name" className="text-base">
              {translate("crm.setup.name", { _: "Business name" })}
            </Label>
            <Input
              id="business-name"
              value={name}
              maxLength={200}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </section>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-base font-medium">
              {translate("crm.setup.country", { _: "Country" })}
            </legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-3">
              {packs.map((p) => (
                <ChoiceButton
                  key={p.code}
                  selected={p.code === countryCode}
                  onSelect={() => chooseCountry(p.code)}
                  title={translate(`crm.countries.${p.code}`, { _: p.name })}
                  hint={p.currency}
                />
              ))}
            </div>
            {pack ? (
              <p className="text-sm text-muted-foreground">
                {translate("crm.setup.country_hint", {
                  _: "Money in %{currency}, time zone %{timezone}.",
                  currency: pack.currency,
                  timezone: pack.timezone,
                })}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-base font-medium">
              {translate("crm.setup.business_type", {
                _: "What does the business do?",
              })}
            </legend>
            <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
              {BUSINESS_TYPES.map((type) => (
                <ChoiceButton
                  key={type}
                  selected={type === businessType}
                  onSelect={() => setBusinessType(type)}
                  title={translate(`crm.business_types.${type}`, {
                    _: BUSINESS_TYPE_LABELS[type],
                  })}
                  hint={translate(`crm.business_types.${type}_hint`, {
                    _: BUSINESS_TYPE_HINTS[type],
                  })}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-base font-medium">
              {translate("crm.setup.requisites", { _: "Requisites" })}
            </legend>
            <RequisiteFields
              fields={fields}
              value={requisites}
              onChange={setRequisites}
            />
          </fieldset>

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit || isPending}
              className="h-12 text-base"
            >
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {translate("crm.setup.create", { _: "Create business" })}
            </Button>
            {current ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => window.history.back()}
              >
                {translate("ra.action.cancel")}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => logout()}>
                {translate("ra.auth.logout")}
              </Button>
            )}
          </div>
        </form>
      </main>
      <Notification />
    </div>
  );
};

SetupPage.path = "/setup";

interface ChoiceButtonProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}

const ChoiceButton = ({
  selected,
  onSelect,
  title,
  hint,
}: ChoiceButtonProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onSelect}
    className={`flex min-h-16 flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      selected
        ? "border-primary bg-primary/5"
        : "border-border hover:border-foreground/30"
    }`}
  >
    <span className="font-medium">{title}</span>
    <span className="text-sm text-muted-foreground">{hint}</span>
  </button>
);

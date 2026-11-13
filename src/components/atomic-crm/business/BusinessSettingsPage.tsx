import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  useDataProvider,
  useNotify,
  useStoreContext,
  useTranslate,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { reloadApp } from "./reloadApp";
import type { CrmDataProvider } from "../providers/types";
import { CONFIGURATION_STORE_KEY } from "../root/ConfigurationContext";
import { RequisiteFields } from "./RequisiteFields";
import {
  compactRequisites,
  findInvalidRequisites,
  findMissingRequisites,
} from "./requisiteRules";
import {
  BUSINESS_ROLES,
  type Business,
  type BusinessMember,
  type BusinessRole,
  type Requisites,
} from "./types";

const ROLE_LABELS: Record<BusinessRole, string> = {
  owner: "Owner",
  manager: "Manager",
  specialist: "Specialist",
  storekeeper: "Storekeeper",
  accountant: "Accountant (read only)",
  partner: "Implementation partner",
};

/** Settings of the current business, for its owners. */
export const BusinessSettingsPage = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data: business } = useQuery({
    queryKey: ["businesses", "current-or-none"],
    queryFn: () => dataProvider.getCurrentBusiness(),
  });

  if (!business) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-12 py-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        {translate("crm.business_settings.title", { _: "Business" })}
      </h1>
      <BusinessDetails business={business} />
      <BusinessMembers business={business} />
      <DeleteBusiness business={business} />
    </div>
  );
};

BusinessSettingsPage.path = "/business";

const BusinessDetails = ({ business }: { business: Business }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [name, setName] = useState(business.name);
  const [requisites, setRequisites] = useState<Requisites>(business.requisites);

  useEffect(() => {
    setName(business.name);
    setRequisites(business.requisites);
  }, [business]);

  const countryCode = business.country_code;
  const { data: fields = [] } = useQuery({
    queryKey: ["requisite_fields", countryCode],
    queryFn: () => dataProvider.getRequisiteFields(countryCode!),
    enabled: countryCode != null,
  });

  const invalid = findInvalidRequisites(fields, requisites);
  const missing = findMissingRequisites(fields, requisites);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      dataProvider.updateBusiness(business.id, {
        name: name.trim(),
        requisites: compactRequisites(requisites),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      notify("crm.business_settings.saved", {
        messageArgs: { _: "Business saved" },
      });
    },
    onError: (error: Error) => notify(error.message, { type: "error" }),
  });

  return (
    <section className="flex flex-col gap-6" aria-labelledby="business-details">
      <h2 id="business-details" className="text-xl font-semibold">
        {translate("crm.business_settings.details", { _: "Details" })}
      </h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="business-name">
          {translate("crm.setup.name", { _: "Business name" })}
        </Label>
        <Input
          id="business-name"
          value={name}
          maxLength={200}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">
          {translate("crm.setup.country", { _: "Country" })}
        </dt>
        <dd>
          {countryCode
            ? translate(`crm.countries.${countryCode}`, { _: countryCode })
            : "—"}
        </dd>
        <dt className="text-muted-foreground">
          {translate("crm.business_settings.currency", { _: "Base currency" })}
        </dt>
        <dd>{business.currency}</dd>
        <dt className="text-muted-foreground">
          {translate("crm.business_settings.timezone", { _: "Time zone" })}
        </dt>
        <dd>{business.timezone}</dd>
      </dl>
      {countryCode ? (
        <RequisiteFields
          fields={fields}
          value={requisites}
          onChange={setRequisites}
        />
      ) : null}
      <div>
        <Button
          onClick={() => mutate()}
          disabled={
            isPending ||
            name.trim() === "" ||
            invalid.length > 0 ||
            missing.length > 0
          }
        >
          {translate("ra.action.save")}
        </Button>
      </div>
    </section>
  );
};

const BusinessMembers = ({ business }: { business: Business }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data: members = [] } = useQuery({
    queryKey: ["businesses", business.id, "members"],
    queryFn: () => dataProvider.getBusinessMembers(business.id),
  });

  const { mutate } = useMutation({
    mutationFn: ({
      member,
      changes,
    }: {
      member: BusinessMember;
      changes: { role?: BusinessRole; disabled?: boolean };
    }) => dataProvider.setMember(member.user_id, changes),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["businesses", business.id, "members"],
      }),
    onError: (error: Error) => notify(error.message, { type: "error" }),
  });

  return (
    <section className="flex flex-col gap-4" aria-labelledby="business-members">
      <h2 id="business-members" className="text-xl font-semibold">
        {translate("crm.business_settings.members", { _: "People" })}
      </h2>
      <p className="text-sm text-muted-foreground">
        {translate("crm.business_settings.members_hint", {
          _: "Invite people from the Users page. Here you choose what they can do in this business.",
        })}
      </p>
      <ul className="flex flex-col divide-y divide-border">
        {members.map((member) => {
          const fullName = `${member.first_name} ${member.last_name}`;
          return (
            <li
              key={member.user_id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
            >
              <div className="min-w-40 grow">
                <p className="font-medium">{fullName}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
              <select
                aria-label={translate("crm.business_settings.role", {
                  _: "Role",
                })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={member.role}
                onChange={(event) =>
                  mutate({
                    member,
                    changes: { role: event.target.value as BusinessRole },
                  })
                }
              >
                {BUSINESS_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {translate(`crm.roles.${role}`, { _: ROLE_LABELS[role] })}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={!member.disabled}
                  disabled={member.is_me}
                  onCheckedChange={(checked) =>
                    mutate({ member, changes: { disabled: !checked } })
                  }
                />
                {translate("crm.business_settings.has_access", {
                  _: "Has access",
                })}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const DeleteBusiness = ({ business }: { business: Business }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const store = useStoreContext();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [confirmation, setConfirmation] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () => dataProvider.deleteBusiness(business.id, confirmation),
    onSuccess: () => {
      store.removeItem(CONFIGURATION_STORE_KEY);
      reloadApp();
    },
    onError: (error: Error) => notify(error.message, { type: "error" }),
  });

  return (
    <section
      className="flex flex-col gap-4 rounded-lg border border-destructive/40 p-5"
      aria-labelledby="business-delete"
    >
      <h2 id="business-delete" className="text-xl font-semibold">
        {translate("crm.business_settings.delete_title", {
          _: "Delete the business",
        })}
      </h2>
      <p className="text-sm">
        {translate("crm.business_settings.delete_hint", {
          _: "Deletes all contacts, deals, tasks and notes of %{name}. This cannot be undone. Type the business name to confirm.",
          name: business.name,
        })}
      </p>
      <Label htmlFor="delete-confirmation" className="sr-only">
        {translate("crm.setup.name", { _: "Business name" })}
      </Label>
      <Input
        id="delete-confirmation"
        value={confirmation}
        autoComplete="off"
        placeholder={business.name}
        onChange={(event) => setConfirmation(event.target.value)}
      />
      <div>
        <Button
          variant="destructive"
          disabled={confirmation !== business.name || isPending}
          onClick={() => mutate()}
        >
          {translate("crm.business_settings.delete", {
            _: "Delete business",
          })}
        </Button>
      </div>
    </section>
  );
};

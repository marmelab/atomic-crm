import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  useCreate,
  useGetList,
  useNotify,
  useRecordContext,
  useUpdate,
} from "ra-core";

import type {
  Company,
  CustomerAgreement,
  CustomerCredentialRef,
  CustomerDetails,
} from "../types";
import { WebsiteStatsSection } from "./WebsiteStatsSection";

/**
 * Fliken visas när företaget är kund: vunnen lead-status, en vunnen affär,
 * eller en redan registrerad kundpost.
 */
export const useIsCustomer = (company?: Company): boolean => {
  const { total: nbCustomerDetails = 0 } = useGetList(
    "customer_details",
    {
      pagination: { page: 1, perPage: 1 },
      filter: { company_id: company?.id },
    },
    { enabled: !!company?.id },
  );
  const { total: nbWonDeals = 0 } = useGetList(
    "deals",
    {
      pagination: { page: 1, perPage: 1 },
      filter: { company_id: company?.id, stage: "won" },
    },
    { enabled: !!company?.id },
  );

  return (
    company?.lead_status === "closed_won" ||
    nbCustomerDetails > 0 ||
    nbWonDeals > 0
  );
};

/**
 * "Kund"-fliken på företagssidan — kundregister för levererade kunder:
 * avtal, levererad hemsida, lanseringsdatum och referenser till var
 * inloggningsuppgifter förvaras (ALDRIG faktiska lösenord).
 */
export const CustomerDetailsTab = () => {
  const company = useRecordContext<Company>();
  const { data, isPending, refetch } = useGetList<CustomerDetails>(
    "customer_details",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
      filter: { company_id: company?.id },
    },
    { enabled: !!company?.id },
  );
  const [editing, setEditing] = useState(false);

  if (!company) return null;
  if (isPending) {
    return <p className="text-sm text-muted-foreground p-4">Laddar...</p>;
  }

  const details = data?.[0];

  if (editing || !details) {
    return (
      <CustomerDetailsForm
        companyId={company.id}
        details={details}
        onDone={() => {
          setEditing(false);
          refetch();
        }}
        onCancel={details ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="w-4 h-4 mr-1" />
          Redigera
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Levererad hemsida</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {details.delivered_website_url ? (
            <a
              href={details.delivered_website_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary underline"
            >
              {details.delivered_website_url}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <p className="text-muted-foreground">Ingen hemsida registrerad.</p>
          )}
          {details.launch_date ? (
            <p>
              Lanserad:{" "}
              {new Date(details.launch_date).toLocaleDateString("sv-SE")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <WebsiteStatsSection company={company} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avtal</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {details.agreements.length === 0 ? (
            <p className="text-muted-foreground">Inga avtal registrerade.</p>
          ) : (
            details.agreements.map((agreement, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{agreement.name}</span>
                {agreement.signed_date ? (
                  <Badge variant="outline">
                    Signerat{" "}
                    {new Date(agreement.signed_date).toLocaleDateString(
                      "sv-SE",
                    )}
                  </Badge>
                ) : null}
                {agreement.url ? (
                  <a
                    href={agreement.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline"
                  >
                    Öppna
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : null}
                {agreement.note ? (
                  <span className="text-muted-foreground">
                    {agreement.note}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inloggningsreferenser</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {details.credential_refs.length === 0 ? (
            <p className="text-muted-foreground">Inga referenser.</p>
          ) : (
            details.credential_refs.map((ref, index) => (
              <p key={index}>
                <span className="font-medium">{ref.label}:</span> {ref.location}
              </p>
            ))
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Endast referenser till var uppgifter förvaras — aldrig lösenord.
          </p>
        </CardContent>
      </Card>

      {details.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anteckningar</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {details.notes}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

type FormState = {
  delivered_website_url: string;
  launch_date: string;
  agreements: CustomerAgreement[];
  credential_refs: CustomerCredentialRef[];
  notes: string;
};

const CustomerDetailsForm = ({
  companyId,
  details,
  onDone,
  onCancel,
}: {
  companyId: Company["id"];
  details?: CustomerDetails;
  onDone: () => void;
  onCancel?: () => void;
}) => {
  const notify = useNotify();
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [form, setForm] = useState<FormState>({
    delivered_website_url: details?.delivered_website_url ?? "",
    launch_date: details?.launch_date ?? "",
    agreements: details?.agreements ?? [],
    credential_refs: details?.credential_refs ?? [],
    notes: details?.notes ?? "",
  });

  const saving = isCreating || isUpdating;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setAgreement = (
    index: number,
    patch: Partial<CustomerAgreement>,
  ): void =>
    setField(
      "agreements",
      form.agreements.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    );

  const setCredentialRef = (
    index: number,
    patch: Partial<CustomerCredentialRef>,
  ): void =>
    setField(
      "credential_refs",
      form.credential_refs.map((r, i) =>
        i === index ? { ...r, ...patch } : r,
      ),
    );

  const handleSave = async () => {
    const payload = {
      company_id: companyId,
      delivered_website_url: form.delivered_website_url.trim() || null,
      launch_date: form.launch_date || null,
      agreements: form.agreements.filter((a) => a.name.trim()),
      credential_refs: form.credential_refs.filter(
        (r) => r.label.trim() || r.location.trim(),
      ),
      notes: form.notes.trim() || null,
    };
    try {
      if (details) {
        await update(
          "customer_details",
          { id: details.id, data: payload, previousData: details },
          { returnPromise: true },
        );
      } else {
        await create(
          "customer_details",
          { data: payload },
          { returnPromise: true },
        );
      }
      notify("Kunduppgifter sparade", { type: "info" });
      onDone();
    } catch (error) {
      console.error("Could not save customer details:", error);
      notify("Kunde inte spara kunduppgifterna", { type: "warning" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {details ? "Redigera kunduppgifter" : "Registrera kund"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delivered_website_url">Levererad hemsida</Label>
            <Input
              id="delivered_website_url"
              placeholder="https://kundenssida.se"
              value={form.delivered_website_url}
              onChange={(e) =>
                setField("delivered_website_url", e.target.value)
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="launch_date">Lanseringsdatum</Label>
            <Input
              id="launch_date"
              type="date"
              value={form.launch_date}
              onChange={(e) => setField("launch_date", e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Avtal</Label>
          {form.agreements.map((agreement, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <Input
                className="flex-1 min-w-32"
                placeholder="Avtalsnamn"
                value={agreement.name}
                onChange={(e) => setAgreement(index, { name: e.target.value })}
              />
              <Input
                className="w-36"
                type="date"
                value={agreement.signed_date ?? ""}
                onChange={(e) =>
                  setAgreement(index, { signed_date: e.target.value || null })
                }
              />
              <Input
                className="flex-1 min-w-32"
                placeholder="Länk (valfritt)"
                value={agreement.url ?? ""}
                onChange={(e) =>
                  setAgreement(index, { url: e.target.value || null })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setField(
                    "agreements",
                    form.agreements.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 className="w-4 h-4" />
                <span className="sr-only">Ta bort avtal</span>
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setField("agreements", [
                ...form.agreements,
                { name: "", signed_date: null, url: null, note: null },
              ])
            }
          >
            <Plus className="w-4 h-4 mr-1" />
            Lägg till avtal
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Inloggningsreferenser</Label>
          <p className="text-xs text-muted-foreground">
            Skriv var uppgifterna förvaras (t.ex. &quot;1Password: Kund X&quot;)
            — aldrig faktiska lösenord.
          </p>
          {form.credential_refs.map((ref, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <Input
                className="flex-1 min-w-32"
                placeholder="Vad (t.ex. Vercel-konto)"
                value={ref.label}
                onChange={(e) =>
                  setCredentialRef(index, { label: e.target.value })
                }
              />
              <Input
                className="flex-1 min-w-32"
                placeholder="Var (t.ex. 1Password: Kund X)"
                value={ref.location}
                onChange={(e) =>
                  setCredentialRef(index, { location: e.target.value })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setField(
                    "credential_refs",
                    form.credential_refs.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 className="w-4 h-4" />
                <span className="sr-only">Ta bort referens</span>
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setField("credential_refs", [
                ...form.credential_refs,
                { label: "", location: "" },
              ])
            }
          >
            <Plus className="w-4 h-4 mr-1" />
            Lägg till referens
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="customer_notes">Anteckningar</Label>
          <Textarea
            id="customer_notes"
            rows={4}
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              Avbryt
            </Button>
          ) : null}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Sparar..." : "Spara"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

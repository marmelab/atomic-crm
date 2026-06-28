import { useMemo, useState } from "react";
import type React from "react";
import { Link } from "react-router";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  UserRoundSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import type { CrmDataProvider } from "../providers/types";
import type { Contact, DailyResearchActivity } from "../types";
import {
  getLeadQualityItems,
  getResearchStatusLabel,
  isLeadReadyForReview,
} from "./research";

export const LukeCommandCenter = () => {
  const { identity } = useGetIdentity();
  const userId = identity?.id;

  const { data: assignedLeads = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: userId
        ? {
            assigned_to_user_id: userId,
            "research_status@neq": "approved_for_instantly",
          }
        : {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "last_seen", order: "DESC" },
    },
    { enabled: Boolean(userId) },
  );

  const todaysAssignedCompanies = useMemo(
    () =>
      Array.from(
        new Map(
          assignedLeads
            .filter((lead) => lead.company_id)
            .map((lead) => [
              String(lead.company_id),
              {
                id: lead.company_id,
                name: lead.company_name ?? "Unnamed company",
                website: lead.company_website,
                status: lead.research_status,
              },
            ]),
        ).values(),
      ).slice(0, 8),
    [assignedLeads],
  );

  const contactsToEnrich = assignedLeads
    .filter(
      (lead) =>
        !lead.ready_for_review &&
        !["approved_for_instantly", "rejected", "bad_fit"].includes(
          lead.research_status ?? "new",
        ),
    )
    .slice(0, 8);

  const readyForReview = assignedLeads
    .filter(
      (lead) =>
        lead.ready_for_review || lead.research_status === "ready_for_review",
    )
    .slice(0, 8);

  const blockers = assignedLeads
    .filter((lead) => (lead.research_status ?? "new") === "needs_fixing")
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          Luke Command Center
        </h1>
        <p className="text-sm text-muted-foreground">
          {assignedLeads.length} assigned leads in progress
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <MetricCard title="Companies" value={todaysAssignedCompanies.length} />
        <MetricCard
          title="Contacts to enrich"
          value={contactsToEnrich.length}
        />
        <MetricCard title="Ready for review" value={readyForReview.length} />
        <MetricCard title="Blockers" value={blockers.length} tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRoundSearch className="size-5" />
              Today&apos;s assigned companies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todaysAssignedCompanies.length ? (
              todaysAssignedCompanies.map((company) => (
                <div
                  key={String(company.id)}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <Link
                      className="font-medium hover:underline"
                      to={`/companies/${company.id}/show`}
                    >
                      {company.name}
                    </Link>
                    <div className="truncate text-sm text-muted-foreground">
                      {company.website}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {getResearchStatusLabel(company.status)}
                  </Badge>
                </div>
              ))
            ) : (
              <EmptyState label="No assigned companies yet." />
            )}
          </CardContent>
        </Card>

        <LeadQueue
          title="Contacts to enrich"
          icon={<Clock className="size-5" />}
          leads={contactsToEnrich}
          action="mark-ready"
        />

        <LeadQueue
          title="Leads ready for review"
          icon={<CheckCircle2 className="size-5" />}
          leads={readyForReview}
        />

        <LeadQueue
          title="Blockers"
          icon={<AlertTriangle className="size-5" />}
          leads={blockers}
        />
      </div>

      <EodReportForm userId={userId} />
    </div>
  );
};

LukeCommandCenter.path = "/dashboard/luke";

const MetricCard = ({
  title,
  value,
  tone = "default",
}: {
  title: string;
  value: number;
  tone?: "default" | "warning";
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div
        className={
          tone === "warning"
            ? "text-2xl font-semibold text-amber-700"
            : "text-2xl font-semibold"
        }
      >
        {value}
      </div>
    </CardContent>
  </Card>
);

const LeadQueue = ({
  title,
  icon,
  leads,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  leads: Contact[];
  action?: "mark-ready";
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending }] = useUpdate<Contact>();

  const markReady = (lead: Contact) => {
    update(
      "contacts",
      {
        id: lead.id,
        data: {
          ready_for_review: true,
          research_status: "ready_for_review",
        },
        previousData: lead,
      },
      {
        onSuccess: () => {
          notify("Lead marked ready for review", { type: "success" });
          refresh();
        },
        onError: () => notify("Could not update lead", { type: "error" }),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {leads.length ? (
          leads.map((lead) => (
            <div key={lead.id} className="space-y-3 rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    className="font-medium hover:underline"
                    to={`/contacts/${lead.id}/show`}
                  >
                    {[lead.first_name, lead.last_name]
                      .filter(Boolean)
                      .join(" ") || "Unnamed contact"}
                  </Link>
                  <div className="truncate text-sm text-muted-foreground">
                    {lead.title || "No title"}{" "}
                    {lead.company_name ? `at ${lead.company_name}` : ""}
                  </div>
                </div>
                <Badge
                  variant={isLeadReadyForReview(lead) ? "default" : "secondary"}
                >
                  {getResearchStatusLabel(lead.research_status)}
                </Badge>
              </div>
              <LeadQualityChecklist lead={lead} />
              {action === "mark-ready" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => markReady(lead)}
                >
                  <Send />
                  Mark ready
                </Button>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState label="Nothing here right now." />
        )}
      </CardContent>
    </Card>
  );
};

const LeadQualityChecklist = ({ lead }: { lead: Contact }) => (
  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
    {getLeadQualityItems(lead).map((item) => (
      <div
        key={item.label}
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <span
          className={
            item.complete
              ? "size-2 rounded-full bg-emerald-500"
              : "size-2 rounded-full bg-muted-foreground/40"
          }
        />
        <span>
          {item.label}
          {item.optional ? " (optional)" : ""}
        </span>
      </div>
    ))}
  </div>
);

const EodReportForm = ({ userId }: { userId?: string | number }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    companies_added: 0,
    contacts_found: 0,
    emails_verified: 0,
    crm_records_updated: 0,
    ready_for_instantly: 0,
    bad_fits_removed: 0,
    blockers: "",
    tomorrow_plan: "",
  });

  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: typeof current[field] === "number" ? Number(value) : value,
    }));
  };

  const submit = async () => {
    if (!userId) return;
    setIsSubmitting(true);
    const today = new Date().toISOString().slice(0, 10);
    try {
      await dataProvider.submitDailyResearchActivity({
        ...form,
        user_id: userId,
        date: today,
      } as DailyResearchActivity);
      notify("EOD report submitted", { type: "success" });
      refresh();
    } catch {
      notify("Could not submit EOD report", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Submit EOD report</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ["companies_added", "Companies added"],
          ["contacts_found", "Contacts found"],
          ["emails_verified", "Emails verified"],
          ["crm_records_updated", "CRM records updated"],
          ["ready_for_instantly", "Ready for Instantly"],
          ["bad_fits_removed", "Bad fits removed"],
        ].map(([field, label]) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={field}>{label}</Label>
            <Input
              id={field}
              type="number"
              min={0}
              value={form[field as keyof typeof form]}
              onChange={(event) =>
                setField(field as keyof typeof form, event.target.value)
              }
            />
          </div>
        ))}
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="blockers">Blockers</Label>
          <Textarea
            id="blockers"
            value={form.blockers}
            onChange={(event) => setField("blockers", event.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="tomorrow_plan">Tomorrow plan</Label>
          <Textarea
            id="tomorrow_plan"
            value={form.tomorrow_plan}
            onChange={(event) => setField("tomorrow_plan", event.target.value)}
          />
        </div>
        <div className="md:col-span-3">
          <Button
            type="button"
            disabled={!userId || isSubmitting}
            onClick={submit}
          >
            Submit report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyState = ({ label }: { label: string }) => (
  <p className="text-sm text-muted-foreground">{label}</p>
);

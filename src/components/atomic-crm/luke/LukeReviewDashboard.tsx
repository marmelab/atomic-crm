import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useGetList, useNotify, useRefresh, useUpdate } from "ra-core";
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ThumbsDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import type { Contact, DailyResearchActivity, Task } from "../types";
import { getLeadQualityItems, getResearchStatusLabel } from "./research";

const today = new Date().toISOString().slice(0, 10);

const weekStart = (() => {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
})();

export const LukeReviewDashboard = () => {
  const { data: rawWaitingLeads = [] } = useGetList<Contact>("contacts", {
    filter: {
      ready_for_review: true,
      approved_for_instantly: false,
    },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "last_seen", order: "DESC" },
  });

  const waitingLeads = rawWaitingLeads.filter(
    (lead) =>
      !["rejected", "bad_fit", "needs_fixing"].includes(
        lead.research_status ?? "new",
      ),
  );

  const { data: approvedLeads = [] } = useGetList<Contact>("contacts", {
    filter: { approved_for_instantly: true },
    pagination: { page: 1, perPage: 20 },
    sort: { field: "last_outreach_at", order: "DESC" },
  });

  const { data: needsWorkLeads = [] } = useGetList<Contact>("contacts", {
    filter: {
      "research_status@in": ["needs_fixing", "rejected", "bad_fit"],
    },
    pagination: { page: 1, perPage: 20 },
    sort: { field: "last_seen", order: "DESC" },
  });

  const { data: todayActivities = [] } = useGetList<DailyResearchActivity>(
    "daily_research_activities",
    {
      filter: { date: today },
      pagination: { page: 1, perPage: 25 },
      sort: { field: "updated_at", order: "DESC" },
    },
  );

  const { data: weekActivities = [] } = useGetList<DailyResearchActivity>(
    "daily_research_activities",
    {
      filter: { "date@gte": weekStart },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "date", order: "DESC" },
    },
  );

  const { data: overdueTasks = [] } = useGetList<Task>("tasks", {
    filter: {
      "due_date@lt": new Date().toISOString(),
      done_date: null,
    },
    pagination: { page: 1, perPage: 10 },
    sort: { field: "due_date", order: "ASC" },
  });

  const todayTotals = useMemo(
    () => totalActivities(todayActivities),
    [todayActivities],
  );
  const weekTotals = useMemo(
    () => totalActivities(weekActivities),
    [weekActivities],
  );
  const blockers = todayActivities.filter((activity) => activity.blockers);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Luke Review</h1>
        <p className="text-sm text-muted-foreground">
          {waitingLeads.length} leads waiting for review
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <MetricCard title="Waiting review" value={waitingLeads.length} />
        <MetricCard title="Output today" value={todayTotals.contacts_found} />
        <MetricCard
          title="Output this week"
          value={weekTotals.contacts_found}
        />
        <MetricCard title="Approved" value={approvedLeads.length} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Leads waiting for review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {waitingLeads.length ? (
              waitingLeads.map((lead) => (
                <ReviewLeadCard key={lead.id} lead={lead} />
              ))
            ) : (
              <EmptyState label="No leads are waiting for review." />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <ActivitySummary title="Luke output today" activity={todayTotals} />
          <ActivitySummary
            title="Luke output this week"
            activity={weekTotals}
          />
          <SimpleLeadList
            title="Approved for Instantly"
            leads={approvedLeads}
          />
          <SimpleLeadList
            title="Rejected / needs fixing"
            leads={needsWorkLeads}
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="size-5" />
                Blockers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {blockers.length ? (
                blockers.map((activity) => (
                  <p
                    key={activity.id}
                    className="rounded-md border p-3 text-sm"
                  >
                    {activity.blockers}
                  </p>
                ))
              ) : (
                <EmptyState label="No blockers submitted today." />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overdue tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdueTasks.length ? (
                overdueTasks.map((task) => (
                  <p key={task.id} className="text-sm">
                    {task.text || task.type || "Untitled task"}
                  </p>
                ))
              ) : (
                <EmptyState label="No overdue tasks." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

LukeReviewDashboard.path = "/dashboard/luke-review";

const ReviewLeadCard = ({ lead }: { lead: Contact }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending }] = useUpdate<Contact>();
  const [reviewNotes, setReviewNotes] = useState(lead.review_notes ?? "");

  const updateLead = (
    data: Partial<Contact>,
    successMessage: string,
    errorMessage = "Could not update lead",
  ) => {
    update(
      "contacts",
      {
        id: lead.id,
        data: { review_notes: reviewNotes, ...data },
        previousData: lead,
      },
      {
        onSuccess: () => {
          notify(successMessage, { type: "success" });
          refresh();
        },
        onError: () => notify(errorMessage, { type: "error" }),
      },
    );
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <Link
            className="font-medium hover:underline"
            to={`/contacts/${lead.id}/show`}
          >
            {[lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
              "Unnamed contact"}
          </Link>
          <p className="text-sm text-muted-foreground">
            {lead.title || "No title"}{" "}
            {lead.company_name ? `at ${lead.company_name}` : ""}
          </p>
        </div>
        <Badge variant="secondary">
          {getResearchStatusLabel(lead.research_status)}
        </Badge>
      </div>

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

      <Textarea
        value={reviewNotes}
        placeholder="Review notes"
        onChange={(event) => setReviewNotes(event.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            updateLead(
              {
                approved_for_instantly: true,
                ready_for_review: true,
                research_status: "approved_for_instantly",
              },
              "Lead approved for Instantly",
            )
          }
        >
          <CheckCircle2 />
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            updateLead(
              {
                approved_for_instantly: false,
                ready_for_review: false,
                research_status: "needs_fixing",
              },
              "Lead marked needs fixing",
            )
          }
        >
          <RotateCcw />
          Needs fixing
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            updateLead(
              {
                approved_for_instantly: false,
                ready_for_review: false,
                research_status: "bad_fit",
              },
              "Lead rejected as bad fit",
            )
          }
        >
          <ThumbsDown />
          Bad fit
        </Button>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value }: { title: string; value: number }) => (
  <Card>
    <CardContent className="p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </CardContent>
  </Card>
);

const ActivitySummary = ({
  title,
  activity,
}: {
  title: string;
  activity: Pick<
    DailyResearchActivity,
    | "companies_added"
    | "contacts_found"
    | "emails_verified"
    | "crm_records_updated"
    | "ready_for_instantly"
    | "bad_fits_removed"
  >;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent className="grid grid-cols-2 gap-3 text-sm">
      <Stat label="Companies" value={activity.companies_added} />
      <Stat label="Contacts" value={activity.contacts_found} />
      <Stat label="Emails" value={activity.emails_verified} />
      <Stat label="CRM updates" value={activity.crm_records_updated} />
      <Stat label="Ready" value={activity.ready_for_instantly} />
      <Stat label="Bad fits" value={activity.bad_fits_removed} />
    </CardContent>
  </Card>
);

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="text-muted-foreground">{label}</div>
    <div className="font-semibold">{value}</div>
  </div>
);

const SimpleLeadList = ({
  title,
  leads,
}: {
  title: string;
  leads: Contact[];
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {leads.length ? (
        leads.map((lead) => (
          <div
            key={lead.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <Link
              className="truncate hover:underline"
              to={`/contacts/${lead.id}/show`}
            >
              {[lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
                lead.company_name ||
                "Unnamed lead"}
            </Link>
            <Badge variant="secondary">
              {getResearchStatusLabel(lead.research_status)}
            </Badge>
          </div>
        ))
      ) : (
        <EmptyState label="No leads found." />
      )}
    </CardContent>
  </Card>
);

const totalActivities = (activities: DailyResearchActivity[]) =>
  activities.reduce(
    (totals, activity) => ({
      companies_added: totals.companies_added + activity.companies_added,
      contacts_found: totals.contacts_found + activity.contacts_found,
      emails_verified: totals.emails_verified + activity.emails_verified,
      crm_records_updated:
        totals.crm_records_updated + activity.crm_records_updated,
      ready_for_instantly:
        totals.ready_for_instantly + activity.ready_for_instantly,
      bad_fits_removed: totals.bad_fits_removed + activity.bad_fits_removed,
    }),
    {
      companies_added: 0,
      contacts_found: 0,
      emails_verified: 0,
      crm_records_updated: 0,
      ready_for_instantly: 0,
      bad_fits_removed: 0,
    },
  );

const EmptyState = ({ label }: { label: string }) => (
  <p className="text-sm text-muted-foreground">{label}</p>
);

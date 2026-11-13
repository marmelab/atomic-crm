import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useMemo } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetMany,
  useLocaleState,
  useTranslate,
  useUpdate,
} from "ra-core";
import { Link } from "react-router";

import { formatMoney } from "../money/money";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { AddTask } from "../tasks/AddTask";
import type { Contact, Deal, Task } from "../types";
import { formatBusinessDate, getBusinessDay } from "./businessDay";

const CLOSED_STAGES = ["won", "lost"];

/**
 * The start screen (TZ section 4.1): what is planned for today, what waits
 * for a decision, and the deals in progress. Days follow the business time
 * zone. Messages join when the chat center exists.
 */
export const TodayPage = () => {
  const translate = useTranslate();
  const [uiLocale = "uk"] = useLocaleState();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const { data: business } = useQuery({
    queryKey: ["businesses", "current-or-none"],
    queryFn: () => dataProvider.getCurrentBusiness(),
  });

  const timeZone = business?.timezone ?? "Europe/Kyiv";
  const day = useMemo(() => getBusinessDay(timeZone), [timeZone]);
  const { weekday, day: date } = formatBusinessDate(
    new Date(),
    timeZone,
    uiLocale,
  );

  const mine = identity?.id != null ? { sales_id: identity.id } : {};
  const { data: planned = [], isPending: plannedPending } = useGetList<Task>(
    "tasks",
    {
      filter: {
        ...mine,
        "done_date@is": null,
        "due_date@gte": day.start.toISOString(),
        "due_date@lt": day.end.toISOString(),
      },
      sort: { field: "due_date", order: "ASC" },
      pagination: { page: 1, perPage: 50 },
    },
    { enabled: identity != null },
  );
  const { data: overdue = [], isPending: overduePending } = useGetList<Task>(
    "tasks",
    {
      filter: {
        ...mine,
        "done_date@is": null,
        "due_date@lt": day.start.toISOString(),
      },
      sort: { field: "due_date", order: "ASC" },
      pagination: { page: 1, perPage: 50 },
    },
    { enabled: identity != null },
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pb-28 pt-6 sm:px-0 sm:pt-8">
      <header>
        <h1 className="flex flex-col leading-none">
          <span className="text-lg font-medium text-muted-foreground first-letter:uppercase">
            {weekday}
          </span>
          <span className="mt-1 text-5xl font-semibold tracking-tight sm:text-7xl">
            {date}
          </span>
        </h1>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-10">
          {overdue.length > 0 ? (
            <TaskSection
              title={translate("crm.today.decide")}
              tasks={overdue}
              overdue
              uiLocale={uiLocale}
              timeZone={timeZone}
            />
          ) : null}
          <TaskSection
            title={translate("crm.today.plan")}
            tasks={planned}
            empty={
              plannedPending || overduePending
                ? null
                : overdue.length === 0
                  ? translate("crm.today.plan_empty") +
                    " " +
                    translate("crm.today.decide_empty")
                  : translate("crm.today.plan_empty")
            }
            uiLocale={uiLocale}
            timeZone={timeZone}
            action={<AddTask selectContact display="chip" />}
          />
        </div>
        <OpenDeals />
      </div>
    </div>
  );
};

interface TaskSectionProps {
  title: string;
  tasks: Task[];
  overdue?: boolean;
  empty?: string | null;
  action?: React.ReactNode;
  uiLocale: string;
  timeZone: string;
}

const TaskSection = ({
  title,
  tasks,
  overdue = false,
  empty,
  action,
  uiLocale,
  timeZone,
}: TaskSectionProps) => {
  const contactIds = [...new Set(tasks.map((task) => task.contact_id))];
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-xl font-semibold">
          {title}
          {tasks.length > 0 ? (
            <span
              className={`ml-2 tabular-nums ${overdue ? "text-destructive" : "text-muted-foreground"}`}
            >
              {tasks.length}
            </span>
          ) : null}
        </h2>
        {action}
      </div>
      {tasks.length === 0 && empty ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg bg-card">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              contact={contactById.get(task.contact_id)}
              overdue={overdue}
              uiLocale={uiLocale}
              timeZone={timeZone}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

interface TaskRowProps {
  task: Task;
  contact?: Contact;
  overdue: boolean;
  uiLocale: string;
  timeZone: string;
}

const TaskRow = ({
  task,
  contact,
  overdue,
  uiLocale,
  timeZone,
}: TaskRowProps) => {
  const translate = useTranslate();
  const { taskTypes } = useConfigurationContext();
  const [update, { isPending }] = useUpdate();
  const type = taskTypes.find((t) => t.value === task.type);
  const due = new Date(task.due_date);
  const when = overdue
    ? translate("crm.today.overdue_since", {
        date: new Intl.DateTimeFormat(uiLocale, {
          timeZone,
          day: "numeric",
          month: "short",
        }).format(due),
      })
    : new Intl.DateTimeFormat(uiLocale, {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(due);

  const markDone = () =>
    update(
      "tasks",
      {
        id: task.id,
        data: { done_date: new Date().toISOString() },
        previousData: task,
      },
      { mutationMode: "undoable" },
    );

  return (
    <li className="flex min-h-14 items-center gap-3 px-3 py-2">
      <button
        type="button"
        onClick={markDone}
        disabled={isPending}
        aria-label={`${translate("crm.today.done")}: ${task.text}`}
        className="group flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-6 items-center justify-center rounded-full border-2 border-muted-foreground/50 transition-colors duration-150 group-hover:border-primary group-hover:bg-accent">
          <Check className="size-4 text-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
        </span>
      </button>
      <div className="min-w-0 grow">
        <p className="truncate font-medium">{task.text}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[
            type && type.value !== "none" ? type.label : null,
            contact ? `${contact.first_name} ${contact.last_name}` : null,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
      </div>
      <span
        className={`shrink-0 text-sm tabular-nums ${overdue ? "text-destructive" : "text-muted-foreground"}`}
      >
        {when}
      </span>
      {contact ? (
        <Link
          to={`/contacts/${contact.id}/show`}
          className="sr-only focus:not-sr-only"
        >
          {contact.first_name} {contact.last_name}
        </Link>
      ) : null}
    </li>
  );
};

const OpenDeals = () => {
  const translate = useTranslate();
  const { currency, locale, dealStages } = useConfigurationContext();
  const { data: activeDeals = [], isPending } = useGetList<Deal>("deals", {
    filter: { "archived_at@is": null },
    pagination: { page: 1, perPage: 500 },
    sort: { field: "updated_at", order: "DESC" },
  });
  const deals = activeDeals.filter(
    (deal) => !CLOSED_STAGES.includes(deal.stage),
  );

  // Deals are in the business currency (stage 1.3)
  const total = deals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
  const byStage = dealStages
    .filter((stage) => !CLOSED_STAGES.includes(stage.value))
    .map((stage) => ({
      ...stage,
      count: deals.filter((deal) => deal.stage === stage.value).length,
    }))
    .filter((stage) => stage.count > 0);

  return (
    <section aria-labelledby="today-pipeline" className="flex flex-col gap-3">
      <h2 id="today-pipeline" className="text-xl font-semibold">
        <Link to="/deals" className="hover:underline">
          {translate("crm.today.pipeline")}
        </Link>
      </h2>
      {isPending ? null : deals.length === 0 ? (
        <p className="text-muted-foreground">
          {translate("crm.today.pipeline_empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg bg-card p-5">
          <p className="text-4xl font-semibold tabular-nums tracking-tight">
            {formatMoney(total, currency, locale)}
          </p>
          <p className="text-muted-foreground">
            {translate("crm.today.pipeline_total", {
              smart_count: deals.length,
            })}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {byStage.map((stage) => (
              <li key={stage.value} className="flex justify-between gap-4">
                <span>{stage.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {stage.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

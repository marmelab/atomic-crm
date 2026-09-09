import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import {
  useDataProvider,
  useDeleteController,
  useGetOne,
  useGetRecordRepresentation,
  useNotify,
  useRefresh,
  useTranslate,
  useUpdate,
} from "ra-core";
import type { Identifier } from "ra-core";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { formatTimestampString } from "../deals/dealUtils";
import { completeOffboardingItem } from "../enrollments/completeOffboardingItem";
import { completeOnboardingItem } from "../enrollments/completeOnboardingItem";
import { reopenOffboardingItem } from "../enrollments/reopenOffboardingItem";
import { reopenOnboardingItem } from "../enrollments/reopenOnboardingItem";
import type { Contact, LabeledValue, Task as TData } from "../types";
import { computePostponeDueDate } from "./postponeTaskDate";
import { taskStatusLabels } from "./taskConstants";
import { TASK_TYPES_WITHOUT_MEANINGFUL_DUE_DATE } from "./tasksPredicate";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";
import { useContactLinkDestination } from "./useContactLinkDestination";
import type { TaskActionDestination } from "./useTaskActionDestination";
import { useTaskActionDestination } from "./useTaskActionDestination";
import { useIsMobile } from "@/hooks/use-mobile";

// The configured label for a task's type (e.g. "review_application" ->
// "Review Application"), falling back to the raw value for a type not in
// the configured list, or null if the task has none at all (nullable at
// the DB level — see supabase/schemas/01_tables.sql's tasks.type).
const typeLabel = (
  task: Pick<TData, "type">,
  taskTypes: LabeledValue[],
): string | null => {
  if (!task.type) return null;
  return taskTypes.find((t) => t.value === task.type)?.label ?? task.type;
};

// Contracts + Onboarding slice, human-acceptance repair: some task types
// carry a fully-formed, task-SPECIFIC sentence as their own `text` (e.g.
// onboarding_item: "Send contract to Jane Doe") rather than a generic
// reminder. For those, the configured type label is actively worse than
// showing nothing — every onboarding Task for one Enrollment shares the
// exact same type ("Onboarding"), so it carries zero distinguishing
// information, while `text` carries all of it (and already names the
// person, so no separate Contact suffix is needed either). The internal
// type string itself is unaffected — this is display-only. Unmatched
// Sales Call Resolution slice: resolve_sales_call joins this set for the
// same reason — its own text is "%{name} · %{offer} · %{when}"
// (resolveSalesCallTask.ts), so a Contact with more than one unresolved
// booking reads as genuinely distinct rows. Client + Session Operations
// cadence correction: resolve_client_session_cadence joins it too — its
// own text names the specific week, so an Enrollment with more than one
// unresolved week also reads as genuinely distinct rows. Client
// Offboarding slice: offboarding_item joins the set for the exact same
// reason as onboarding_item — its own text ("Move Jane Doe's session
// notes to Past Clients") already names the person.
const SELF_DESCRIBING_TASK_TYPES: ReadonlySet<string> = new Set([
  "onboarding_item",
  "offboarding_item",
  "resolve_sales_call",
  "resolve_client_session_cadence",
]);

const displayLabel = (
  task: Pick<TData, "type" | "text">,
  taskTypes: LabeledValue[],
): string | null => {
  if (task.type && SELF_DESCRIBING_TASK_TYPES.has(task.type)) {
    return task.text || typeLabel(task, taskTypes);
  }
  return typeLabel(task, taskTypes);
};

// Manual Task UX repair, round 2: human acceptance found a manually-
// created `other` Task rendering as bare "Other: <name>" — the actual
// instruction Leif typed ("Check in about GYU attendance") was invisible
// without opening the Task. Distinct from SELF_DESCRIBING_TASK_TYPES
// above: those are SYSTEM-generated, and their own auto-written text
// already names the person ("Send contract to Jane Doe"), so the Contact
// suffix is fully suppressed there. A manual `other` Task's text is
// Leif's own words and usually does NOT name anyone, so the Contact
// still needs its own visible line here — just as a separate line below
// the instruction, never concatenated into a "Type: Name" title (there
// is no meaningful type label for "other" to concatenate in the first
// place). Every other configured type (sales_call, follow_up, ...)
// keeps its existing "Type: Name" rendering unchanged — those type
// labels carry real operational meaning "other" never did.
const TEXT_PRIMARY_TASK_TYPES: ReadonlySet<string> = new Set(["other"]);

// Shared by both places a Task row needs to link to the person it's
// about (see useContactLinkDestination.ts's own header comment for why
// this is a hook, not a plain href) — kept as ONE component so the two
// render sites below can never drift.
const ContactLink = ({
  contactId,
  label,
}: {
  contactId: Identifier;
  label: ReactNode;
}) => {
  const { to } = useContactLinkDestination(contactId);
  return (
    <Link
      to={to}
      className="hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
};

const TaskContactLink = ({
  task,
  className,
}: {
  task: TData;
  className?: string;
}) => {
  const translate = useTranslate();
  const getContactRepresentation = useGetRecordRepresentation("contacts");
  return (
    <ReferenceField<TData, Contact>
      source="contact_id"
      reference="contacts"
      record={task}
      className={className}
      // ReferenceField defaults to its OWN auto-link (edit/show) when
      // `link` is omitted, not to no-link — left as-is, that nested
      // <a> inside ContactLink's own <a> below. Explicitly disabled:
      // ContactLink is the only anchor here, routed by
      // useContactLinkDestination.ts (§2 above), never ReferenceField's
      // own hardcoded "show" route.
      link={false}
      // Graceful fallback for a Contact reference that can't be shown
      // (UX cleanup pass, §1) — never crashes, never renders blank or
      // "undefined". Two distinct cases, both bypassing `render`
      // entirely (source/reference-field.tsx): a null contact_id
      // short-circuits to `empty` before ReferenceFieldBase even
      // mounts; a contact_id that fails to resolve (a dangling
      // reference) surfaces as `error`, checked BEFORE `empty` inside
      // ReferenceFieldView — so both props are needed, not just one.
      empty="resources.tasks.unknown_contact"
      error={translate("resources.tasks.unknown_contact", {
        _: "Unknown contact",
      })}
      render={({ referenceRecord }) => (
        <ContactLink
          contactId={task.contact_id}
          label={getContactRepresentation(referenceRecord)}
        />
      )}
    />
  );
};

// The task's primary action: a real, keyboard/mobile-accessible <Link>
// to the resolved Application/Deal when useTaskActionDestination found
// one, or a same-styled button that opens the Task's own edit view when
// it didn't (no destination resolved yet, no type-specific screen exists,
// or the linked record is gone) — never a dead, non-interactive label,
// and never a silent no-op. stopPropagation matches the existing Checkbox
// pattern just above: the row's own onClick (mobile-only, toggles done_date)
// must not also fire when this is what was actually tapped.
const TaskActionLabel = ({
  label,
  suffix = "",
  destination,
  onOpenTaskDetail,
}: {
  label: string | null;
  suffix?: string;
  destination: TaskActionDestination | null;
  onOpenTaskDetail: () => void;
}) => {
  if (!label) return null;
  const text = `${label}${suffix}`;

  if (destination && destination.kind !== "task-detail") {
    return (
      <Link
        to={destination.to}
        className="hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {text}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className="hover:underline cursor-pointer text-left"
      onClick={(event) => {
        event.stopPropagation();
        onOpenTaskDetail();
      }}
    >
      {text}
    </button>
  );
};

export const Task = ({
  task,
  showContact,
  onCompleted,
}: {
  task: TData;
  showContact?: boolean;
  // Fired the instant a not-yet-done Task is checked (never on reopen) —
  // Dashboard task completion UX repair pass: lets the Dashboard keep the
  // row visibly checked in place for a moment before it moves to
  // Completed Today, rather than this component deciding that on its own.
  onCompleted?: (task: TData) => void;
}) => {
  const isMobile = useIsMobile();
  const { taskTypes } = useConfigurationContext();
  const notify = useNotify();
  const navigate = useNavigate();
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider();
  const refresh = useRefresh();
  const getContactRepresentation = useGetRecordRepresentation("contacts");
  // Already fetched by the ReferenceField below in the common case — this
  // read is deduped against that same cache entry, not a second request.
  // Needed synchronously here (not just declaratively in JSX) for the
  // undo toast's task title.
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: task.contact_id },
    { enabled: task.contact_id != null },
  );

  const [openEdit, setOpenEdit] = useState(false);

  const handleCloseEdit = () => {
    setOpenEdit(false);
  };

  const [update, { isPending: isUpdatePending, isSuccess, variables }] =
    useUpdate();
  // Dashboard task completion UX repair pass: a separate hook instance,
  // undoable, only for the checkbox — completing/reopening from postpone
  // or other raw edits stays on the plain `update` above unchanged.
  const [updateDone] = useUpdate();
  // Task delete resurrection fix (human-acceptance repair): this used to
  // go through useDeleteWithUndoController, which hardcodes 'undoable' —
  // an optimistic, CLIENT-SIDE-ONLY removal that only actually calls
  // dataProvider.delete() after an unwatched timer elapses. Navigating
  // away, reloading, or any query refetch inside that window shows the
  // Task again — not a resurrection, the delete had simply never
  // happened yet — which is exactly what human acceptance found.
  // 'pessimistic' mode awaits the real delete before the UI ever reports
  // success, so a completed deletion is always genuinely persisted.
  const { handleDelete } = useDeleteController({
    record: task,
    redirect: false,
    mutationMode: "pessimistic",
    mutationOptions: {
      onSuccess() {
        notify("resources.tasks.deleted");
      },
    },
  });
  // A lifecycle Task (linked to an onboarding/offboarding checklist item)
  // has no supported delete path: the checklist item is the durable
  // source of fulfillment truth, and nothing currently retracts or
  // re-derives it when its Task is removed — deleting the Task would
  // just silently orphan a still-pending requirement with no reminder
  // left for Leif. Rather than offer a Delete that can't do anything
  // useful (or worse, quietly leaves the requirement stranded), the
  // action is withheld entirely for these; Complete/Postpone/Edit stay
  // available as normal.
  const isLifecycleTask =
    task.onboarding_item_id != null || task.offboarding_item_id != null;

  const handleEdit = () => {
    setOpenEdit(true);
  };

  // Task-as-action-launcher repair pass (found via real human Auth
  // acceptance testing): the type label used to be plain, non-interactive
  // text — the only clickable part of the row was the Contact name, which
  // took a reviewer to the Contact page, not to the Application/Deal
  // where the requested action actually happens. Resolved once per row via
  // the shared, centralized policy (taskActionDestination.ts /
  // useTaskActionDestination.ts) — reused by every Task-rendering surface
  // in the app (there is exactly one, Task.tsx), never guessed here.
  const { destination } = useTaskActionDestination(task);

  const taskTitle = (() => {
    if (
      task.type &&
      (SELF_DESCRIBING_TASK_TYPES.has(task.type) ||
        TEXT_PRIMARY_TASK_TYPES.has(task.type))
    ) {
      return task.text || undefined;
    }
    const type = typeLabel(task, taskTypes);
    const name = contact ? getContactRepresentation(contact) : null;
    if (type && name) return `${type}: ${name}`;
    return type ?? name ?? undefined;
  })();

  // Lifecycle-Task completion durability fix (human-acceptance repair):
  // a lifecycle Task's checkbox used to go through the SAME undoable
  // `updateDone` path as a manual Task — patching only the `tasks` row
  // optimistically and trusting the DB's own sync_onboarding_item_from_
  // task()/sync_offboarding_item_from_task() trigger to eventually sync
  // the linked checklist item once react-admin's undo queue got around
  // to firing the real, deferred write. Two lifecycle Tasks checked in
  // quick succession raced: each capture its own stale query-cache
  // snapshot at click time, and when the queue later settled, the
  // resulting invalidation/rollback could revert a genuinely-completed
  // row back to unchecked — confirmed by direct Postgres reads during
  // this investigation (the checklist item and Task DID eventually
  // persist correctly once Leif re-checked them, ruling out permanent
  // data corruption, but the multi-mutation race made the FIRST
  // completion attempt visually unreliable). Root cause is inherent to
  // routing checklist-linked completion through a second, independently-
  // mutated, undo-queued copy of what the checklist item already owns —
  // exactly the "dual competing sources of truth" the governing model
  // rules out. Fixed by calling the SAME authoritative, synchronous
  // (pessimistic — no undo queue, no snapshot race) checklist-item
  // completion functions the checklist's own checkbox already uses
  // (completeOnboardingItem.ts/completeOffboardingItem.ts and their
  // reopen counterparts) — these write the item first, then the Task,
  // both awaited, no optimistic-only state for anything else to race
  // against. A manual Task (no checklist linkage) is entirely unaffected
  // — it keeps the exact undoable behavior it already had, which human
  // acceptance confirmed works correctly.
  const handleCheck = () => async () => {
    const completing = !task.done_date;

    if (isLifecycleTask) {
      if (task.onboarding_item_id != null) {
        if (completing) {
          await completeOnboardingItem(dataProvider, task.onboarding_item_id);
        } else {
          await reopenOnboardingItem(dataProvider, task.onboarding_item_id);
        }
      } else if (task.offboarding_item_id != null) {
        if (completing) {
          await completeOffboardingItem(dataProvider, task.offboarding_item_id);
        } else {
          await reopenOffboardingItem(dataProvider, task.offboarding_item_id);
        }
      }
      if (completing) {
        onCompleted?.(task);
        notify("resources.tasks.completed", {
          type: "info",
          messageArgs: {
            _: "Task completed — %{title}",
            title: taskTitle ?? "",
          },
        });
      }
      refresh();
      return;
    }

    updateDone(
      "tasks",
      {
        id: task.id,
        data: {
          done_date: completing ? new Date().toISOString() : null,
          status: completing ? "completed" : "pending",
        },
        previousData: task,
      },
      {
        mutationMode: "undoable",
        onSuccess: () => {
          if (!completing) return;
          onCompleted?.(task);
          notify("resources.tasks.completed_undoable", {
            type: "info",
            undoable: true,
            messageArgs: {
              _: "Task completed — %{title}",
              title: taskTitle ?? "",
            },
          });
        },
      },
    );
  };

  useEffect(() => {
    // We do not want to invalidate the query when a tack is checked or unchecked
    if (
      isUpdatePending ||
      !isSuccess ||
      variables?.data?.done_date != undefined
    ) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tasks", "getList"] });
  }, [queryClient, isUpdatePending, isSuccess, variables]);

  const labelId = `checkbox-list-label-${task.id}`;

  return (
    <>
      <div className="flex items-start justify-between">
        <div
          className="flex items-start gap-2 flex-1"
          onClick={isMobile ? handleCheck() : undefined}
        >
          {/* No `disabled` here on purpose (Dashboard task completion UX
              repair pass, §E): disabling during the mutation's pending
              window showed a prohibited/not-allowed cursor for as long as
              FakeRest's simulated latency lasted. Undoable mode below
              already updates the cache instantly, so there's nothing that
              needs guarding against a mid-flight double click.
              stopPropagation is load-bearing on mobile (found while adding
              onCompleted, §Repair 6): the row's own onClick above already
              toggles the same Task on mobile for a larger tap target, so
              without this a tap directly on the checkbox bubbled into that
              handler too — firing handleCheck() twice for one tap (a
              double-undo-toast in practice). Desktop is unaffected since
              the row has no onClick to bubble into. */}
          <Checkbox
            id={labelId}
            checked={!!task.done_date}
            onCheckedChange={handleCheck()}
            onClick={(event) => event.stopPropagation()}
            className="mt-1"
          />
          <div className={`flex-grow ${task.done_date ? "line-through" : ""}`}>
            {/* Unmatched Sales Call Resolution slice: a small header above
                the self-describing title, matching Leif's own mockup
                ("Sales call needs matching" / "Jane Doe · Offer · date").
                Only this one type gets it — everything else keeps the
                single-line title unchanged. */}
            {(task.type === "resolve_sales_call" ||
              task.type === "resolve_client_session_cadence") && (
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {typeLabel(task, taskTypes)}
              </div>
            )}
            <div className="text-sm font-semibold">
              {/* Primary title, information-hierarchy pass: "What I need to
                  do, and who for" — "{Task Type}: {Person Name}" — replaces
                  the old "{Type} {task.text}" + trailing "(Re: {name})"
                  (task.text was frequently faker-generated filler in
                  fixtures, not a genuinely useful description, so it's
                  dropped from this compact row rather than concatenated
                  into the title; a real custom note still belongs on the
                  Task's own edit/detail view, untouched by this pass).
                  showContact (unchanged meaning: are we somewhere the
                  contact isn't already obvious, e.g. the Dashboard or a
                  cross-contact task list — never a Contact's own page,
                  which never passes it) decides whether the name is shown
                  at all; when it isn't, the type label alone is the title.
                  Two distinct destinations, deliberately not one ambiguous
                  link across the whole title (task-as-action-launcher
                  repair pass): the type label is the task's own primary
                  action (Application/Deal, resolved above); the Contact
                  name stays its own separate link — useful in its own
                  right, and not what "click the task" should mean.
                  Manual Task UX repair, round 2: TEXT_PRIMARY_TASK_TYPES
                  ("other") is checked FIRST — that free text IS the whole
                  point (§3 above), regardless of showContact; its own
                  Contact context (when relevant) gets a dedicated line
                  below instead of being folded into this title. */}
              {task.type && TEXT_PRIMARY_TASK_TYPES.has(task.type) ? (
                <TaskActionLabel
                  label={task.text || typeLabel(task, taskTypes)}
                  destination={destination}
                  onOpenTaskDetail={handleEdit}
                />
              ) : showContact &&
                !SELF_DESCRIBING_TASK_TYPES.has(task.type ?? "") ? (
                <>
                  <TaskActionLabel
                    label={typeLabel(task, taskTypes)}
                    suffix=": "
                    destination={destination}
                    onOpenTaskDetail={handleEdit}
                  />
                  <TaskContactLink task={task} className="inline" />
                </>
              ) : (
                // Self-describing types (onboarding_item) skip the separate
                // Contact suffix even with showContact on — the text
                // already names the person ("Send contract to Jane Doe"),
                // so repeating "Jane Doe" right after would just be noise.
                <TaskActionLabel
                  label={displayLabel(task, taskTypes)}
                  destination={destination}
                  onOpenTaskDetail={handleEdit}
                />
              )}
              {/* Pending/Completed are already conveyed by the checkbox and
                  strikethrough; only the less obvious states get a badge. */}
              {(task.status === "waiting" || task.status === "cancelled") && (
                <Badge variant="outline" className="ml-2 align-middle">
                  {taskStatusLabels[task.status]}
                </Badge>
              )}
            </div>
            {/* Manual Task UX repair, round 2 (§3/L): a manual `other`
                Task's free text usually doesn't name anyone, unlike
                SELF_DESCRIBING_TASK_TYPES' own auto-written text — so the
                Contact stays visible here as its own line, only where a
                Contact isn't already the obvious page context. */}
            {showContact &&
              task.type &&
              TEXT_PRIMARY_TASK_TYPES.has(task.type) && (
                <div className="text-sm text-muted-foreground">
                  <TaskContactLink task={task} />
                </div>
              )}
            {/* Unmatched Sales Call Resolution slice: this type's due_date
                is an internal field only (Tasks require one at the DB
                level) — showing it here would misrepresent this exception
                as a normal dated to-do Leif failed to do. */}
            {!TASK_TYPES_WITHOUT_MEANINGFUL_DUE_DATE.has(task.type ?? "") && (
              <div className="text-sm text-muted-foreground">
                {translate("resources.tasks.fields.due_short")}
                &nbsp;
                {/* Date only, no time-of-day (Tasks UX cleanup) — reuses
                    dealUtils.ts's own formatTimestampString, the same "PP"
                    (e.g. "Feb 20, 2025") formatter already used for other
                    timestamptz columns like Application.submitted_at.
                    Display-only: task.due_date itself is untouched, still
                    the full timestamp used for sorting/overdue logic/
                    automation (tasksPredicate.ts). */}
                {formatTimestampString(task.due_date)}
              </div>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 pr-0! size-8 cursor-pointer"
              aria-label={translate("resources.tasks.actions.title")}
            >
              <MoreVertical className="size-5 md:size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Postponing this type's internal-only due_date would be
                equally meaningless — same guard as the due-date line
                above. */}
            {!TASK_TYPES_WITHOUT_MEANINGFUL_DUE_DATE.has(task.type ?? "") && (
              <>
                <DropdownMenuItem
                  className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                  onClick={() => {
                    update("tasks", {
                      id: task.id,
                      data: {
                        due_date: computePostponeDueDate(new Date(), 1),
                      },
                      previousData: task,
                    });
                  }}
                >
                  {translate("resources.tasks.actions.postpone_tomorrow")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                  onClick={() => {
                    update("tasks", {
                      id: task.id,
                      data: {
                        due_date: computePostponeDueDate(new Date(), 7),
                      },
                      previousData: task,
                    });
                  }}
                >
                  {translate("resources.tasks.actions.postpone_next_week")}
                </DropdownMenuItem>
              </>
            )}
            {/* Unmatched Sales Call Resolution slice: resolve_sales_call
                must never open the generic Edit sheet — Description/Due
                date/Type/Status answer nothing about "what Opportunity
                does this belong to?". Navigates to the same dedicated
                resolution page the row's own title already links to,
                instead of handleEdit, only for these destination kinds —
                every other type's "Edit" is unchanged. Client + Session
                Operations cadence correction: resolve-client-session-
                cadence joins it for the same reason (Description/Due
                date/Type/Status answer nothing about "known skip,
                rescheduled, or missed/ghosted?" either). */}
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={() => {
                if (
                  destination?.kind === "resolve-sales-call" ||
                  destination?.kind === "resolve-client-session-cadence"
                ) {
                  navigate(destination.to);
                  return;
                }
                handleEdit();
              }}
            >
              {translate("ra.action.edit")}
            </DropdownMenuItem>
            {/* Withheld for lifecycle Tasks — see isLifecycleTask's own
                comment above for why Delete has no supported meaning
                there; Edit/Postpone above remain available. */}
            {!isLifecycleTask && (
              <DropdownMenuItem
                className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                onClick={handleDelete}
              >
                {translate("ra.action.delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isMobile ? (
        <TaskEditSheet
          taskId={task.id}
          open={openEdit}
          onOpenChange={setOpenEdit}
        />
      ) : (
        <TaskEdit taskId={task.id} open={openEdit} close={handleCloseEdit} />
      )}
    </>
  );
};

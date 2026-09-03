import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import {
  useDeleteWithUndoController,
  useGetOne,
  useGetRecordRepresentation,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
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
import type { Contact, LabeledValue, Task as TData } from "../types";
import { computePostponeDueDate } from "./postponeTaskDate";
import { taskStatusLabels } from "./taskConstants";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";
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
  const translate = useTranslate();
  const queryClient = useQueryClient();
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
  const { handleDelete } = useDeleteWithUndoController({
    record: task,
    redirect: false,
    mutationOptions: {
      onSuccess() {
        notify("resources.tasks.deleted", {
          undoable: true,
        });
      },
    },
  });

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
    const type = typeLabel(task, taskTypes);
    const name = contact ? getContactRepresentation(contact) : null;
    if (type && name) return `${type}: ${name}`;
    return type ?? name ?? undefined;
  })();

  const handleCheck = () => () => {
    const completing = !task.done_date;
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
                  name stays its own separate link to the Contact page —
                  useful in its own right, and not what "click the task"
                  should mean. */}
              {showContact ? (
                <>
                  <TaskActionLabel
                    label={typeLabel(task, taskTypes)}
                    suffix=": "
                    destination={destination}
                    onOpenTaskDetail={handleEdit}
                  />
                  <ReferenceField<TData, Contact>
                    source="contact_id"
                    reference="contacts"
                    record={task}
                    link="show"
                    className="inline"
                    // Graceful fallback for a Contact reference that can't
                    // be shown (UX cleanup pass, §1) — never crashes,
                    // never renders blank or "undefined". Two distinct
                    // cases, both bypassing `render` entirely
                    // (source/reference-field.tsx): a null contact_id
                    // short-circuits to `empty` before ReferenceFieldBase
                    // even mounts; a contact_id that fails to resolve (a
                    // dangling reference) surfaces as `error`, checked
                    // BEFORE `empty` inside ReferenceFieldView — so both
                    // props are needed, not just one.
                    empty="resources.tasks.unknown_contact"
                    error={translate("resources.tasks.unknown_contact", {
                      _: "Unknown contact",
                    })}
                    render={({ referenceRecord }) =>
                      getContactRepresentation(referenceRecord)
                    }
                  />
                </>
              ) : (
                <TaskActionLabel
                  label={typeLabel(task, taskTypes) ?? task.text}
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
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: { due_date: computePostponeDueDate(new Date(), 1) },
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
                  data: { due_date: computePostponeDueDate(new Date(), 7) },
                  previousData: task,
                });
              }}
            >
              {translate("resources.tasks.actions.postpone_next_week")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={handleEdit}
            >
              {translate("ra.action.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={handleDelete}
            >
              {translate("ra.action.delete")}
            </DropdownMenuItem>
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

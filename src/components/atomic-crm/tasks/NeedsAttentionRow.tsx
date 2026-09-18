import { useGetOne } from "ra-core";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";

import type { Contact, Task } from "../types";
import { describeTaskKind } from "./needsAttentionInventory";
import { useTaskActionDestination } from "./useTaskActionDestination";

// A Needs Attention row, in the shape of the question it is asking.
//
// The old row led with the internal type in shouted capitals —
// "SALES CALL NEEDS MATCHING" — above a title that repeated it, and the
// only way to act was to guess which part of the sentence was a link.
// Leif's own mockup is the target, and it is four things:
//
//   WHO      Megan Auron
//   WHAT     What happened on the Jul 7 sales call?
//   WHEN     the date, when a date means something
//   DO       [Resolve]
//
// The question and the button's verb both come from the shared inventory
// (needsAttentionInventory.ts), so a new task type gets a coherent row by
// being described once rather than by being special-cased here.
export const NeedsAttentionRow = ({ task }: { task: Task }) => {
  const navigate = useNavigate();
  const kind = describeTaskKind(task.type);
  const { destination } = useTaskActionDestination(task);

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: task.contact_id as number },
    { enabled: task.contact_id != null },
  );

  const who = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : null;

  // The inventory's question is the general form; the task's own text is
  // the specific one when somebody wrote it. Prefer the specific.
  const what = kind?.question ?? task.text ?? "This needs a decision.";

  // Only shown when the date is a commitment somebody made, never when
  // it is the "now" the row was created at. dueDateMeans being null is
  // exactly that distinction.
  const when =
    kind?.dueDateMeans != null && task.due_date
      ? new Date(task.due_date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        {who && (
          <div className="text-sm font-semibold truncate">
            {task.contact_id != null ? (
              <Link
                to={`/contacts/${task.contact_id}/show`}
                className="hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {who}
              </Link>
            ) : (
              who
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground">{what}</p>
        {task.text && task.text !== what && (
          <p className="text-xs text-muted-foreground truncate">{task.text}</p>
        )}
        {when && <p className="text-xs text-muted-foreground">{when}</p>}
      </div>

      {destination && destination.kind !== "task-detail" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => navigate(destination.to)}
        >
          {kind?.actionLabel ?? "Open"}
        </Button>
      )}
    </div>
  );
};

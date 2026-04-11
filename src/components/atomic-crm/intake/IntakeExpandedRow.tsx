import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IntakeLead } from "../types";

const OUTREACH_CADENCE = [
  { day: 1, label: "Day 1", type: "Email" },
  { day: 3, label: "Day 3", type: "Email" },
  { day: 4, label: "Day 4", type: "LinkedIn" },
  { day: 7, label: "Day 7", type: "Phone" },
  { day: 14, label: "Day 14", type: "Email" },
  { day: 21, label: "Day 21", type: "Phone" },
  { day: 28, label: "Day 28", type: "Email" },
];

export const IntakeExpandedRow = ({ record }: { record: IntakeLead }) => {
  const notify = useNotify();
  const hasOutreachHistory = record.outreach_sequence_step > 0;
  const currentStepIndex = Math.max(record.outreach_sequence_step - 1, 0);

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-2xl border bg-card p-4">
        <h4 className="mb-2 font-heading text-base font-extrabold">
          AI Enrichment Summary
        </h4>
        <p className="text-sm leading-6 text-muted-foreground">
          {record.enrichment_summary || "No enrichment data yet."}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h4 className="mb-2 font-heading text-base font-extrabold">
          Outreach Draft
        </h4>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {record.outreach_draft || "No draft generated yet."}
        </p>
        {record.outreach_draft ? (
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() =>
                notify("Outreach sending coming soon", { type: "info" })
              }
            >
              Send Now
            </Button>
            <Button size="sm" variant="outline">
              Edit Draft
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h4 className="mb-3 font-heading text-base font-extrabold">
          Cadence Timeline
        </h4>
        {!hasOutreachHistory && record.status !== "in-sequence" ? (
          <p className="text-sm leading-6 text-muted-foreground">
            No outreach history yet. Sequence activity will appear here after the
            first touch.
          </p>
        ) : (
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold">
            {OUTREACH_CADENCE.map((touch, index) => {
              const isCurrent =
                record.status === "in-sequence" && index === currentStepIndex;
              const isCompleted =
                record.status === "in-sequence"
                  ? index < currentStepIndex
                  : index < record.outreach_sequence_step;

              return (
                <div
                  key={touch.day}
                  className={cn(
                    "rounded-xl px-2 py-3",
                    isCompleted
                      ? "bg-green-500/12 text-green-700"
                      : isCurrent
                        ? "bg-primary/12 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <div>
                    {touch.label}
                    {isCompleted ? (
                      <>
                        {" "}
                        &#10003;
                      </>
                    ) : isCurrent ? (
                      <>
                        {" "}
                        &rarr;
                      </>
                    ) : null}
                  </div>
                  <div className="mt-1 font-medium">
                    {touch.type} &middot;{" "}
                    {isCompleted ? "sent" : isCurrent ? "next" : "pending"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

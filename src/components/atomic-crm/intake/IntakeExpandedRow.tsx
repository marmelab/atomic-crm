import { useState } from "react";
import { useGetList, useRefresh } from "ra-core";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { IntakeLead, OutreachStep } from "../types";
import { getSupabaseClient } from "../providers/supabase/supabase";

const STEP_STATUS_CONFIG: Record<
  OutreachStep["status"],
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  drafting: { label: "Drafting", variant: "secondary" },
  ai_reviewed: { label: "Ready for Review", variant: "default" },
  action_needed: {
    label: "Action Needed",
    variant: "outline",
    className: "border-amber-500 text-amber-600",
  },
  approved: { label: "Approved", variant: "default" },
  sent: {
    label: "Sent",
    variant: "outline",
    className: "border-green-500/50 bg-green-50 text-green-700",
  },
  completed: {
    label: "Completed",
    variant: "outline",
    className: "border-green-500/50 bg-green-50 text-green-700",
  },
  failed: { label: "Failed", variant: "destructive" },
  replied: {
    label: "Replied",
    variant: "outline",
    className: "border-purple-500 text-purple-600",
  },
};

export const IntakeExpandedRow = ({ record }: { record: IntakeLead }) => {
  const [expandedStepIds, setExpandedStepIds] = useState<Array<number | string>>(
    [],
  );
  const [isSending, setIsSending] = useState(false);
  const refresh = useRefresh();

  const { data: steps = [], isPending } = useGetList<OutreachStep>(
    "outreach_steps",
    {
      filter: { intake_lead_id: record.id },
      sort: { field: "sequence_step", order: "ASC" },
    },
  );

  const toggleExpanded = (stepId: number | string) => {
    setExpandedStepIds((current) =>
      current.includes(stepId)
        ? current.filter((expandedId) => expandedId !== stepId)
        : [...current, stepId],
    );
  };

  const handleSend = async (stepId: number | string) => {
    setIsSending(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl === "undefined") {
        toast.error("Send not available in demo mode");
        setIsSending(false);
        return;
      }

      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession();

      const response = await fetch(supabaseUrl + "/functions/v1/send-outreach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (session?.access_token ?? ""),
        },
        body: JSON.stringify({ outreach_step_id: stepId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Send failed");
      }

      toast.success("Email sent successfully");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkComplete = async (step: OutreachStep) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl === "undefined") {
        toast.info("Not available in demo mode");
        return;
      }

      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession();

      const response = await fetch(
        supabaseUrl + "/functions/v1/upsert-outreach-step",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + (session?.access_token ?? ""),
          },
          body: JSON.stringify({
            intake_lead_id: step.intake_lead_id,
            sequence_step: step.sequence_step,
            status: "completed",
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to mark step as complete");
      }

      toast.success("Step marked as complete");
      refresh();
    } catch {
      toast.error("Failed to mark step as complete");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1">
        <div className="overflow-hidden rounded-2xl border bg-card p-4">
          <h4 className="mb-2 font-heading text-base font-extrabold">
            AI Enrichment Summary
          </h4>
          <p className="text-sm leading-6 text-muted-foreground">
            {record.enrichment_summary || "No enrichment data yet."}
          </p>
        </div>
      </div>

      <div className="space-y-3 lg:col-span-2">
        {isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : steps.length === 0 ? (
          <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            No outreach steps yet. Steps will appear here when the outreach
            generator runs.
          </div>
        ) : (
          steps.map((step) => {
            const expanded = expandedStepIds.includes(step.id);
            const statusConfig = STEP_STATUS_CONFIG[step.status];
            const displayDate = step.sent_at || step.created_at;

            return (
              <div
                key={step.id}
                className="flex cursor-pointer gap-3 rounded-xl border bg-card p-3"
                onClick={() => toggleExpanded(step.id)}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {step.sequence_step}
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">
                    {step.channel}
                  </span>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">
                      {step.subject || "No subject"}
                    </div>
                    <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {step.body || "No message body yet."}
                    </p>
                    <Badge
                      variant={statusConfig.variant}
                      className={cn("rounded-full", statusConfig.className)}
                    >
                      {statusConfig.label}
                    </Badge>
                  </div>

                  {expanded ? (
                    <div
                      className="space-y-3 border-t pt-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Subject
                        </div>
                        <div className="text-sm font-medium">
                          {step.subject || "No subject"}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Message
                        </div>
                        {step.status === "drafting" ||
                        step.status === "ai_reviewed" ? (
                          <textarea
                            readOnly
                            value={step.body || ""}
                            className="min-h-32 w-full resize-none rounded-lg border bg-muted/30 p-3 text-sm leading-6 text-foreground"
                          />
                        ) : (
                          <div className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm leading-6">
                            {step.body || "No message body yet."}
                          </div>
                        )}
                      </div>

                      {step.status === "replied" && step.reply_body ? (
                        <div className="space-y-1 rounded-lg border bg-muted/20 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Reply
                          </div>
                          <div className="whitespace-pre-wrap text-sm leading-6">
                            {step.reply_body}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-3 text-right">
                  <div className="text-xs text-muted-foreground">
                    {formatStepDate(displayDate)}
                  </div>

                  {step.status === "ai_reviewed" && step.channel === "email" ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Approve &amp; Send
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Send this outreach email?</DialogTitle>
                          <DialogDescription>
                            This will send the email to {record.email} via
                            Postmark. This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                          </DialogClose>
                          <Button
                            onClick={() => {
                              void handleSend(step.id);
                            }}
                            disabled={isSending}
                          >
                            {isSending ? "Sending..." : "Send Email"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : null}

                  {step.status === "action_needed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleMarkComplete(step);
                      }}
                    >
                      Mark Complete
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const formatStepDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

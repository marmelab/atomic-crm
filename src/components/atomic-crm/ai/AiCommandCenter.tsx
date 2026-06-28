import { useMemo, useState } from "react";
import { useDataProvider, useGetList, useNotify, useRefresh } from "ra-core";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  AiAuditEvent,
  AiCommand,
  AiCommandStatus,
  AiSourceType,
} from "../types";
import type { CrmDataProvider } from "../providers/types";

const visibleStatuses: AiCommandStatus[] = [
  "pending",
  "completed",
  "rejected",
  "failed",
];

const statusLabels: Record<AiCommandStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  executing: "Executing",
  completed: "Completed",
  failed: "Failed",
  rejected: "Rejected",
  expired: "Expired",
};

export const AiCommandCenter = () => {
  const refresh = useRefresh();
  const { data: commands = [], isPending } = useGetList<AiCommand>(
    "ai_commands",
    {
      filter: {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "created_at", order: "DESC" },
    },
  );

  const byStatus = useMemo(
    () =>
      visibleStatuses.reduce(
        (acc, status) => ({
          ...acc,
          [status]: commands.filter((command) => command.status === status),
        }),
        {} as Record<AiCommandStatus, AiCommand[]>,
      ),
    [commands],
  );

  const pendingCount = byStatus.pending?.length ?? 0;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            AI Command Center
          </h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount} commands waiting for approval
          </p>
        </div>
        <Button type="button" variant="outline" onClick={refresh}>
          <RefreshCw />
          Refresh
        </Button>
      </div>

      <ManualCommandForm />

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:w-fit md:grid-cols-4">
          {visibleStatuses.map((status) => (
            <TabsTrigger key={status} value={status} className="gap-2">
              {statusLabels[status]}
              <Badge variant="secondary">{byStatus[status]?.length ?? 0}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleStatuses.map((status) => (
          <TabsContent key={status} value={status} className="space-y-3">
            {isPending ? (
              <EmptyState label="Loading commands." />
            ) : byStatus[status]?.length ? (
              byStatus[status].map((command) => (
                <CommandCard key={command.id} command={command} />
              ))
            ) : (
              <EmptyState
                label={`No ${statusLabels[status].toLowerCase()} commands.`}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

AiCommandCenter.path = "/dashboard/ai-command-center";

const ManualCommandForm = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [successDefinition, setSuccessDefinition] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    const parsedContactId = Number(contactId);
    if (!title.trim() || !Number.isFinite(parsedContactId)) {
      notify("Add a title and numeric contact id", { type: "warning" });
      return;
    }

    setIsSubmitting(true);
    try {
      await dataProvider.createAiCommand({
        source_ai: "manual",
        command_type: "create_luke_task",
        target_entity_type: "task",
        payload: {
          title: title.trim(),
          contact_id: parsedContactId,
          success_definition: successDefinition.trim() || undefined,
          priority: "medium",
          type: "Research",
        },
      });
      notify("Command created", { type: "success" });
      setTitle("");
      setContactId("");
      setSuccessDefinition("");
      refresh();
    } catch (error) {
      notify((error as Error).message || "Could not create command", {
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="size-5" />
          Create Luke task command
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_180px]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
            <div className="space-y-2">
              <Label htmlFor="ai-command-title">Task title</Label>
              <Input
                id="ai-command-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-command-contact">Contact id</Label>
              <Input
                id="ai-command-contact"
                inputMode="numeric"
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-command-success">Success definition</Label>
            <Textarea
              id="ai-command-success"
              value={successDefinition}
              onChange={(event) => setSuccessDefinition(event.target.value)}
            />
          </div>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            className="w-full"
            disabled={isSubmitting}
            onClick={submit}
          >
            <Send />
            Submit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const CommandCard = ({ command }: { command: AiCommand }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isBusy, setIsBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const { data: auditEvents = [] } = useGetList<AiAuditEvent>(
    "ai_audit_events",
    {
      filter: { command_id: command.id },
      pagination: { page: 1, perPage: 25 },
      sort: { field: "created_at", order: "DESC" },
    },
  );

  const approve = async () => {
    setIsBusy(true);
    try {
      await dataProvider.approveAiCommand(command.id);
      notify("Command approved", { type: "success" });
      refresh();
    } catch (error) {
      notify((error as Error).message || "Could not approve command", {
        type: "error",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const reject = async () => {
    setIsBusy(true);
    try {
      await dataProvider.rejectAiCommand(command.id, rejectReason);
      notify("Command rejected", { type: "success" });
      refresh();
    } catch (error) {
      notify((error as Error).message || "Could not reject command", {
        type: "error",
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={command.status} />
              <Badge variant="outline">{formatSource(command.source_ai)}</Badge>
              <span className="text-sm text-muted-foreground">
                #{command.id}
              </span>
            </div>
            <h2 className="text-base font-semibold tracking-normal">
              {String(command.payload.title ?? command.command_type)}
            </h2>
            <p className="text-sm text-muted-foreground">
              Created {formatDate(command.created_at)} · Expires{" "}
              {formatDate(command.expires_at)}
            </p>
          </div>
          {command.status === "pending" ? (
            <div className="flex flex-col gap-2 md:w-72">
              <Textarea
                value={rejectReason}
                placeholder="Reject reason"
                onChange={(event) => setRejectReason(event.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isBusy}
                  onClick={approve}
                >
                  <CheckCircle2 />
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={reject}
                >
                  <XCircle />
                  Reject
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <Fact label="Command" value={command.command_type} />
          <Fact
            label="Target"
            value={[
              command.target_entity_type,
              command.target_entity_id ? `#${command.target_entity_id}` : null,
            ]
              .filter(Boolean)
              .join(" ")}
          />
          <Fact
            label="Executed"
            value={command.executed_at ? formatDate(command.executed_at) : "No"}
          />
        </div>

        {command.error_message ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {command.error_message}
          </div>
        ) : null}

        <Details title="Payload" value={command.payload} />
        <Details title="Result" value={command.execution_result} />

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Audit events</h3>
          {auditEvents.length ? (
            <div className="space-y-2">
              {auditEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-1 rounded-md border p-3 text-sm md:flex-row md:items-center md:justify-between"
                >
                  <span>{event.action}</span>
                  <span className="text-muted-foreground">
                    {formatDate(event.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No audit events yet." />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const StatusBadge = ({ status }: { status: AiCommandStatus }) => {
  const Icon =
    status === "completed"
      ? CheckCircle2
      : status === "failed" || status === "rejected" || status === "expired"
        ? CircleAlert
        : Clock3;

  return (
    <Badge variant={status === "completed" ? "default" : "secondary"}>
      <Icon className="size-3" />
      {statusLabels[status]}
    </Badge>
  );
};

const Fact = ({ label, value }: { label: string; value?: string }) => (
  <div className="rounded-md border p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="break-words font-medium">{value || "None"}</div>
  </div>
);

const Details = ({
  title,
  value,
}: {
  title: string;
  value?: Record<string, unknown> | null;
}) => {
  if (!value || Object.keys(value).length === 0) {
    return null;
  }

  return (
    <details className="rounded-md border p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <ChevronDown className="size-4" />
        {title}
      </summary>
      <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatSource = (source: AiSourceType) =>
  ({
    chatgpt: "ChatGPT",
    claude: "Claude",
    gemini: "Gemini",
    manual: "Manual",
    system: "System",
  })[source];

const EmptyState = ({ label }: { label: string }) => (
  <p className="text-sm text-muted-foreground">{label}</p>
);

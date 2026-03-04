/**
 * Payload and validation for the workflow_notify Edge Function.
 */

export interface WorkflowNotifyPayload {
  /** Which notification channel to use */
  channel: "email_external" | "notify_owner";
  /** For email_external: resolve from trigger record's client or use custom */
  recipient_type?: "client_email" | "custom";
  /** For email_external + custom: the target address */
  custom_email?: string;
  /** For email_external: email subject (supports template placeholders) */
  subject?: string;
  /** For email_external: email body plain text (supports template placeholders) */
  body?: string;
  /** For notify_owner: notification message (supports template placeholders) */
  message?: string;
  /** The resource table that triggered the workflow */
  trigger_resource: string;
  /** The ID of the record that triggered the workflow */
  trigger_record_id: string;
}

export interface WorkflowNotifyResponse {
  channel: string;
  ok: boolean;
  detail?: Record<string, unknown>;
}

export function validateWorkflowNotifyPayload(
  payload: WorkflowNotifyPayload,
): string | null {
  if (!payload.channel) {
    return "channel is required";
  }

  if (!["email_external", "notify_owner"].includes(payload.channel)) {
    return `Invalid channel: ${payload.channel}`;
  }

  if (!payload.trigger_resource || !payload.trigger_record_id) {
    return "trigger_resource and trigger_record_id are required";
  }

  if (payload.channel === "email_external") {
    if (!payload.subject?.trim()) {
      return "subject is required for email_external";
    }
    if (!payload.body?.trim()) {
      return "body is required for email_external";
    }
    if (payload.recipient_type === "custom" && !payload.custom_email?.trim()) {
      return "custom_email is required when recipient_type is custom";
    }
  }

  if (payload.channel === "notify_owner") {
    if (!payload.message?.trim()) {
      return "message is required for notify_owner";
    }
  }

  return null;
}

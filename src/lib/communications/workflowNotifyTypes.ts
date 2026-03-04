/**
 * Client-side types for the workflow_notify Edge Function.
 */

export interface WorkflowNotifyPayload {
  channel: "email_external" | "notify_owner";
  recipient_type?: "client_email" | "custom";
  custom_email?: string;
  subject?: string;
  body?: string;
  message?: string;
  trigger_resource: string;
  trigger_record_id: string;
}

export interface WorkflowNotifyResponse {
  channel: string;
  ok: boolean;
  detail?: Record<string, unknown>;
}

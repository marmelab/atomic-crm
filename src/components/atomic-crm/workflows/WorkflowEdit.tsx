import { EditBase, Form, useEditContext } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Workflow, WorkflowAction } from "../types";
import { WorkflowInputs } from "./WorkflowInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { MobileBackButton } from "../misc/MobileBackButton";
import { MobilePageTitle } from "../layout/MobilePageTitle";
import { workflowTransform } from "./workflowTransform";

export const WorkflowEdit = () => (
  <EditBase redirect="list" transform={workflowTransform}>
    <WorkflowEditContent />
  </EditBase>
);

/** Flatten the first action from the JSONB array into flat form fields. */
const flattenAction = (actions?: WorkflowAction[]) => {
  const first = actions?.[0];
  if (!first) return {};
  const d = first.data ?? {};
  return {
    action_type: first.type,
    action_task_text: first.type === "create_task" ? String(d.text ?? "") : "",
    action_task_due_days:
      first.type === "create_task" ? String(d.due_days ?? "3") : "3",
    action_field_name:
      first.type === "update_field" ? String(d.field ?? "") : "",
    action_field_value:
      first.type === "update_field" ? String(d.value ?? "") : "",
    action_email_recipient_type:
      first.type === "send_email"
        ? String(d.recipient_type ?? "client_email")
        : "client_email",
    action_email_custom_address:
      first.type === "send_email" ? String(d.custom_email ?? "") : "",
    action_email_subject:
      first.type === "send_email" ? String(d.subject ?? "") : "",
    action_email_body:
      first.type === "send_email" ? String(d.body ?? "") : "",
    action_notification_message:
      first.type === "send_notification" ? String(d.message ?? "") : "",
  };
};

const WorkflowEditContent = () => {
  const { isPending, record } = useEditContext<Workflow>();
  const isMobile = useIsMobile();
  if (isPending || !record) return null;

  const defaultValues = {
    ...record,
    trigger_conditions_json: JSON.stringify(
      record.trigger_conditions ?? {},
      null,
      2,
    ),
    ...flattenAction(record.actions),
  };

  return (
    <div className="mt-4 flex gap-4 md:gap-8 px-4 md:px-0">
      <Form
        className="flex flex-1 flex-col gap-4"
        defaultValues={defaultValues}
      >
        {isMobile && (
          <div className="space-y-2">
            <MobileBackButton />
            <MobilePageTitle title="Modifica automazione" />
          </div>
        )}
        <Card>
          <CardContent>
            <WorkflowInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>
    </div>
  );
};

import { CreateBase, Form } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSearchParams } from "react-router";

import { WorkflowInputs } from "./WorkflowInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { MobileBackButton } from "../misc/MobileBackButton";
import { MobilePageTitle } from "../layout/MobilePageTitle";
import { workflowTransform } from "./workflowTransform";

const useWorkflowDefaultValues = () => {
  const [searchParams] = useSearchParams();
  const defaults: Record<string, unknown> = {
    is_active: true,
    trigger_event: "status_changed",
    action_type: "create_task",
  };

  const paramKeys = [
    "name",
    "description",
    "trigger_resource",
    "trigger_event",
    "action_type",
    "condition_status",
    "action_task_text",
    "action_task_due_days",
    "action_email_subject",
    "action_email_body",
    "action_notification_message",
  ] as const;

  for (const key of paramKeys) {
    const value = searchParams.get(key);
    if (value) defaults[key] = value;
  }

  return defaults;
};

export const WorkflowCreate = () => {
  const isMobile = useIsMobile();
  const defaultValues = useWorkflowDefaultValues();

  return (
    <CreateBase redirect="list" transform={workflowTransform}>
      <div className="mt-4 flex gap-4 md:gap-8 px-4 md:px-0">
        <div className="flex-1">
          <Form defaultValues={defaultValues}>
            {isMobile && (
              <div className="mb-3 space-y-2">
                <MobileBackButton />
                <MobilePageTitle title="Nuova automazione" />
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
      </div>
    </CreateBase>
  );
};

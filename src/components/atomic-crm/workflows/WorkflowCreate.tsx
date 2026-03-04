import { CreateBase, Form } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { WorkflowInputs } from "./WorkflowInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { MobileBackButton } from "../misc/MobileBackButton";
import { workflowTransform } from "./workflowTransform";

export const WorkflowCreate = () => {
  const isMobile = useIsMobile();

  return (
    <CreateBase redirect="list" transform={workflowTransform}>
      <div className="mt-4 flex px-4 md:px-0">
        <div className="flex-1">
          <Form
            defaultValues={{
              is_active: true,
              trigger_event: "status_changed",
              trigger_conditions_json: "{}",
              action_type: "create_task",
            }}
          >
            {isMobile && (
              <div className="mb-3">
                <MobileBackButton />
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

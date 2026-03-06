import { CreateBase, Form } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { ProjectInputs } from "./ProjectInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { MobileBackButton } from "../misc/MobileBackButton";

export const ProjectCreate = () => {
  const isMobile = useIsMobile();

  return (
    <CreateBase redirect="show">
      <div className="mt-4 mb-28 md:mb-2 flex flex-col px-4 md:px-0">
        <div className="flex-1">
          <Form defaultValues={{ all_day: true }}>
            {isMobile && (
              <div className="mb-3">
                <MobileBackButton />
              </div>
            )}
            <Card>
              <CardContent>
                <ProjectInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};

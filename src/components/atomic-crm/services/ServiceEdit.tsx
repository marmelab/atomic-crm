import { EditBase, Form, useEditContext } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Service } from "../types";
import { ServiceInputs } from "./ServiceInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { MobileBackButton } from "../misc/MobileBackButton";

export const ServiceEdit = () => (
  <EditBase redirect="show">
    <ServiceEditContent />
  </EditBase>
);

const ServiceEditContent = () => {
  const { isPending, record } = useEditContext<Service>();
  const isMobile = useIsMobile();
  if (isPending || !record) return null;
  return (
    <div className="mt-4 mb-28 md:mb-2 flex flex-col gap-4 px-4 md:px-0">
      <Form className="flex flex-1 flex-col gap-4">
        {isMobile && (
          <div>
            <MobileBackButton />
          </div>
        )}
        <Card className="max-w-full overflow-hidden">
          <CardContent>
            <ServiceInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>
    </div>
  );
};

import { EditBase, Form, useEditContext } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Payment } from "../types";
import { PaymentInputs } from "./PaymentInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { MobileBackButton } from "../misc/MobileBackButton";

export const PaymentEdit = () => (
  <EditBase redirect="show">
    <PaymentEditContent />
  </EditBase>
);

const PaymentEditContent = () => {
  const { isPending, record } = useEditContext<Payment>();
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
        <Card>
          <CardContent>
            <PaymentInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>
    </div>
  );
};

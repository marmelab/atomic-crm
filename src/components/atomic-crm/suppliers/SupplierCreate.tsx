import { CreateBase, Form } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { SupplierInputs } from "./SupplierInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { MobileBackButton } from "../misc/MobileBackButton";

export const SupplierCreate = () => (
  <CreateBase redirect="show">
    <div className="mt-4 mb-28 md:mb-2 flex flex-col px-4 md:px-0">
      <div className="flex-1">
        <SupplierCreateForm />
      </div>
    </div>
  </CreateBase>
);

const SupplierCreateForm = () => {
  const isMobile = useIsMobile();

  return (
    <Form>
      {isMobile && (
        <div className="mb-3">
          <MobileBackButton />
        </div>
      )}
      <Card>
        <CardContent>
          <SupplierInputs />
          <FormToolbar />
        </CardContent>
      </Card>
    </Form>
  );
};

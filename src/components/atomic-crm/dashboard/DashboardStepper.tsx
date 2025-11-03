import { CheckCircle, Circle } from "lucide-react";
import type { Identifier } from "ra-core";
import { Link } from "react-router";
import { CreateButton } from "@/components/admin/create-button";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { ContactImportButton } from "../contacts/ContactImportButton";
import useAppBarHeight from "../misc/useAppBarHeight";

export const DashboardStepper = ({
  step,
  contactId,
}: {
  step: number;
  contactId?: Identifier;
}) => {
  const appbarHeight = useAppBarHeight();
  return (
    <div
      className="flex justify-center items-center"
      style={{
        height: `calc(100dvh - ${appbarHeight}px)`,
      }}
    >
      <Card className="w-full max-w-[600px]">
        <CardContent className="px-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold">What's next?</h3>
            <div className="w-[150px]">
              <Progress value={(step / 3) * 100} className="mb-2" />
              <div className="text-right text-sm">{step}/3 done</div>
            </div>
          </div>
          <div className="flex flex-col gap-12">
            <div className="flex gap-8 items-center">
              <CheckCircle className="text-green-600 w-5 h-5" />
              <h4 className="font-bold">Install Atomic CRM</h4>
            </div>
            <div className="flex gap-8 items-start">
              {step > 1 ? (
                <CheckCircle className="text-green-600 w-5 h-5 mt-1" />
              ) : (
                <Circle className="text-muted-foreground w-5 h-5 mt-1" />
              )}

              <div className="flex flex-col gap-4">
                <h4 className="font-bold">Add your first contact</h4>

                <div className="flex gap-8">
                  <CreateButton label="New Contact" resource="contacts" />
                  <ContactImportButton />
                </div>
              </div>
            </div>
            <div className="flex gap-8 items-start">
              <Circle className="text-muted-foreground w-5 h-5 mt-1" />
              <div className="flex flex-col gap-4">
                <h4 className="font-bold">Add your first note</h4>
                <p>Go to a contact page and add a note</p>
                <Button asChild disabled={step < 2} className="w-[100px]">
                  <Link to={`/contacts/${contactId}/show`}>Add note</Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

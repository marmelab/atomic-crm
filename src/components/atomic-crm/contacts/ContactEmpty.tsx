import { CreateButton } from "@/components/admin/create-button";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTranslate } from "ra-core";

import useAppBarHeight from "../misc/useAppBarHeight";
import { ContactImportButton } from "./ContactImportButton";
import { ContactCreateSheet } from "./ContactCreateSheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const ContactEmpty = () => {
  const appbarHeight = useAppBarHeight();
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <>
      <ContactCreateSheet open={createOpen} onOpenChange={setCreateOpen} />
      <div
        className="flex flex-col justify-center items-center gap-3"
        style={{
          height: `calc(100dvh - ${appbarHeight}px)`,
        }}
      >
        <img
          src="./img/empty.svg"
          alt={translate("resources.contacts.empty.title")}
        />
        <div className="flex flex-col gap-0 items-center">
          <h6 className="text-lg font-bold">
            {translate("resources.contacts.empty.title")}
          </h6>
          <p className="text-sm text-muted-foreground text-center mb-4">
            {translate("resources.contacts.empty.description")}
          </p>
        </div>
        <div className="flex flex-row gap-2">
          {isMobile ? (
            <Button
              onClick={() => setCreateOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {translate("resources.contacts.action.new")}
            </Button>
          ) : (
            <>
              <CreateButton label="resources.contacts.action.new" />
              <ContactImportButton />
            </>
          )}
        </div>
      </div>
    </>
  );
};

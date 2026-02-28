import { CreateButton } from "@/components/admin/create-button";
import { useState } from "react";
import { useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

import useAppBarHeight from "../misc/useAppBarHeight";
import { ContactImportButton } from "./ContactImportButton";
import { ContactCreateSheet } from "./ContactCreateSheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const ContactEmpty = () => {
  const translate = useTranslate();
  const appbarHeight = useAppBarHeight();
  const isMobile = useIsMobile();
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
          alt={translate("crm.contacts.empty.title", { _: "No contacts found" })}
        />
        <div className="flex flex-col gap-0 items-center">
          <h6 className="text-lg font-bold">
            {translate("crm.contacts.empty.title", { _: "No contacts found" })}
          </h6>
          <p className="text-sm text-muted-foreground text-center mb-4">
            {translate("crm.contacts.empty.description", {
              _: "It seems your contact list is empty.",
            })}
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
              {translate("crm.contacts.new_contact", { _: "New Contact" })}
            </Button>
          ) : (
            <>
              <CreateButton label="crm.contacts.new_contact" />
              <ContactImportButton />
            </>
          )}
        </div>
      </div>
    </>
  );
};

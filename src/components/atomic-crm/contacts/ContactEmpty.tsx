import { CreateButton } from "@/components/admin/create-button";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

import useAppBarHeight from "../misc/useAppBarHeight";
import { ContactImportButton } from "./ContactImportButton";
import { ContactCreateSheet } from "./ContactCreateSheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const ContactEmpty = () => {
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
        <img src="./img/empty.svg" alt="No contacts found" className="w-48 h-48" />
        <div className="flex flex-col gap-2 items-center">
          <h2 className="text-xl font-bold">No contacts found</h2>
          <p className="text-sm text-muted-foreground text-center">
            It seems your contact list is empty.
          </p>
          <p className="text-sm text-muted-foreground text-center mb-2">
            Create your first contact or import from a CSV file.
          </p>
        </div>
        <div className="flex flex-row gap-3">
          {isMobile ? (
            <Button
              onClick={() => setCreateOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Contact
            </Button>
          ) : (
            <>
              <CreateButton label="New Contact" />
              <ContactImportButton />
            </>
          )}
        </div>
      </div>
    </>
  );
};

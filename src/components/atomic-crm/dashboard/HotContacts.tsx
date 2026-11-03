import { Plus, Users } from "lucide-react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Contact } from "../types";
import { DashboardContactList } from "./DashboardContactList";

export const HotContacts = () => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const {
    data: contactData,
    total: contactTotal,
    isPending: contactsLoading,
  } = useGetList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "last_seen", order: "DESC" },
      filter: { status: "hot", sales_id: identity?.id },
    },
    { enabled: Number.isInteger(identity?.id) },
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <div className="mr-3 flex">
          <Users className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
          {translate("resources.contacts.hot.title")}
        </h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  to="/contacts/create"
                  aria-label={translate("resources.contacts.action.create")}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "ml-auto text-muted-foreground",
                  )}
                />
              }
            >
              <Plus className="w-4 h-4 text-primary" />
            </TooltipTrigger>
            <TooltipContent>
              {translate("resources.contacts.action.create")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <DashboardContactList
        data={contactData}
        total={contactTotal}
        isPending={contactsLoading}
        empty={
          <div className="p-4">
            <p className="text-sm mb-4">
              {translate("resources.contacts.hot.empty_hint")}
            </p>
            <p className="text-sm">
              {translate("resources.contacts.hot.empty_change_status")}
            </p>
          </div>
        }
      />
    </div>
  );
};

import { Plus, Users } from "lucide-react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { SimpleList } from "../simple-list/SimpleList";
import { Avatar } from "../contacts/Avatar";
import type { Contact } from "../types";

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
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                asChild
              >
                <Link to="/contacts/create">
                  <Plus className="w-4 h-4 text-primary" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {translate("resources.contacts.action.create")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Card className="py-0">
        <SimpleList<Contact>
          linkType="show"
          data={contactData}
          total={contactTotal}
          isPending={contactsLoading}
          resource="contacts"
          className="[&>li:first-child>a]:rounded-t-xl [&>li:last-child>a]:rounded-b-xl"
          primaryText={(contact) =>
            `${contact.first_name} ${contact.last_name}`
          }
          secondaryText={(contact) => (
            <>
              {contact.title && contact.company_name
                ? translate("resources.contacts.position_at_company", {
                    title: contact.title,
                    company: contact.company_name,
                  })
                : contact.title || contact.company_name}
            </>
          )}
          leftAvatar={(contact) => <Avatar record={contact} />}
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
      </Card>
    </div>
  );
};

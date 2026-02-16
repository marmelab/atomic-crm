import { Plus, Users } from "lucide-react";
import { useGetIdentity, useGetList } from "ra-core";
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Users className="size-6 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-muted-foreground flex-1">
          Hot Contacts
        </h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                asChild
              >
                <Link to="/contacts/create">
                  <Plus className="size-4 mr-1" />
                  <span className="hidden sm:inline">Add</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create contact</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Card className="overflow-hidden">
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
              {contact.title} at {contact.company_name}
            </>
          )}
          leftAvatar={(contact) => <Avatar record={contact} />}
          empty={
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Contacts with a "hot" status will appear here.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Change the status of a contact by adding a note and selecting "hot" status.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contacts">View all contacts</Link>
              </Button>
            </div>
          }
        />
      </Card>
    </div>
  );
};

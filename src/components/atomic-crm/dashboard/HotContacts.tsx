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
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <div className="mr-3 flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--nosho-orange)]/10">
          <Users className="text-[var(--nosho-orange)] w-4 h-4" />
        </div>
        <h2 className="text-base font-semibold text-muted-foreground flex-1">
          Contacts chauds
        </h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link to="/contacts/create">
                  <Plus className="w-4 h-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Créer un contact</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Card className="py-0 shadow-sm border-border/50">
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
            <div className="p-4">
              <p className="text-sm mb-4">
                Les contacts avec le statut &quot;Chaud&quot; apparaissent ici.
              </p>
              <p className="text-sm">
                Changez le statut via &quot;Options avancées&quot; lors de
                l&apos;ajout d&apos;une note.
              </p>
            </div>
          }
        />
      </Card>
    </div>
  );
};

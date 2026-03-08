import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGetList, useGetMany, useShowContext } from "ra-core";
import { Link } from "react-router";
import { Mail, Phone, FolderOpen } from "lucide-react";

import type { Client, Project, ProjectContact, Contact } from "../types";
import { buildContactCreatePath } from "./contactLinking";
import {
  compareContactsForClientContext,
  getContactDisplayName,
  getContactPrimaryEmail,
  getContactPrimaryPhone,
  getContactResolvedRole,
  getContactRoleLabel,
  isContactPrimaryForClient,
} from "./contactRecord";

export const ClientContactsSection = () => {
  const { record } = useShowContext<Client>();
  const { data: contacts, isPending } = useGetList<Contact>(
    "contacts",
    {
      filter: { "client_id@eq": String(record?.id ?? "") },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { enabled: !!record?.id },
  );
  const contactIds = (contacts ?? []).map((contact) => contact.id);
  const { data: projectLinks } = useGetList<ProjectContact>(
    "project_contacts",
    {
      filter: {},
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "ASC" },
    },
    { enabled: contactIds.length > 0 },
  );
  const relevantProjectLinks = (projectLinks ?? []).filter((link) =>
    contactIds.some(
      (contactId) => String(contactId) === String(link.contact_id),
    ),
  );
  const projectIds = [
    ...new Set(relevantProjectLinks.map((link) => link.project_id)),
  ];
  const { data: projects } = useGetMany<Project>(
    "projects",
    { ids: projectIds },
    { enabled: projectIds.length > 0 },
  );
  const sortedContacts = [...(contacts ?? [])].sort(
    compareContactsForClientContext,
  );

  if (!record) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Referenti
        </h3>
        <Button asChild size="sm" variant="outline">
          <Link
            to={buildContactCreatePath({
              clientId: String(record.id),
            })}
          >
            Nuovo referente
          </Link>
        </Button>
      </div>

      {isPending ? null : !contacts?.length ? (
        <p className="text-sm text-muted-foreground">
          Nessun referente associato a questo cliente.
        </p>
      ) : (
        <div className="divide-y">
          {sortedContacts.map((contact) => {
            const linkedProjectNames = relevantProjectLinks
              .filter((link) => String(link.contact_id) === String(contact.id))
              .map(
                (link) =>
                  projects?.find(
                    (project) => String(project.id) === String(link.project_id),
                  )?.name ?? "Progetto",
              );

            const roleLabel = getContactRoleLabel(
              getContactResolvedRole(contact),
            );
            const email = getContactPrimaryEmail(contact);
            const phone = getContactPrimaryPhone(contact);

            return (
              <div key={contact.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/contacts/${contact.id}/show`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {getContactDisplayName(contact)}
                  </Link>
                  {isContactPrimaryForClient(contact) && (
                    <Badge variant="secondary" className="text-[11px]">
                      Principale
                    </Badge>
                  )}
                  {roleLabel && (
                    <Badge variant="outline" className="text-[11px]">
                      {roleLabel}
                    </Badge>
                  )}
                  {contact.title && (
                    <span className="text-xs text-muted-foreground">
                      — {contact.title}
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3" />
                      {email}
                    </span>
                  )}
                  {phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" />
                      {phone}
                    </span>
                  )}
                  {linkedProjectNames.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <FolderOpen className="size-3" />
                      {linkedProjectNames.join(" · ")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

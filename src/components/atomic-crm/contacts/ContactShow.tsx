import {
  ShowBase,
  useDelete,
  useGetList,
  useGetMany,
  useGetOne,
  useShowContext,
} from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone, Briefcase, Link2, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Contact, Project, ProjectContact } from "../types";
import { CloudinaryImageField } from "../cloudinary/CloudinaryImageField";
import { ErrorMessage } from "../misc/ErrorMessage";
import { MobileBackButton } from "../misc/MobileBackButton";
import {
  getContactDisplayName,
  getContactPrimaryEmail,
  getContactPrimaryPhone,
  getContactResolvedRole,
  getContactRoleLabel,
  isContactPrimaryForClient,
} from "./contactRecord";

export const ContactShow = () => (
  <ShowBase>
    <ContactShowContent />
  </ShowBase>
);

const ContactShowContent = () => {
  const { record, isPending, error } = useShowContext<Contact>();
  const { data: client } = useGetOne(
    "clients",
    { id: record?.client_id as string },
    { enabled: !!record?.client_id },
  );
  const { data: supplier } = useGetOne(
    "suppliers",
    { id: record?.supplier_id as string },
    { enabled: !!record?.supplier_id },
  );
  const projectLinksQuery = useGetList<ProjectContact>(
    "project_contacts",
    {
      filter: { "contact_id@eq": String(record?.id ?? "") },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "created_at", order: "ASC" },
    },
    { enabled: !!record?.id },
  );
  const projectIds = (projectLinksQuery.data ?? []).map(
    (link) => link.project_id,
  );
  const { data: projects } = useGetMany<Project>(
    "projects",
    { ids: projectIds },
    { enabled: projectIds.length > 0 },
  );
  const isMobile = useIsMobile();

  if (error) return <ErrorMessage />;
  if (isPending || !record) return null;

  const roleLabel = getContactRoleLabel(getContactResolvedRole(record));

  return (
    <div className="mt-4 mb-28 md:mb-2 flex flex-col gap-6 px-4 md:px-0">
      {isMobile && (
        <div className="mb-3">
          <MobileBackButton />
        </div>
      )}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {record.photo_url && (
                <CloudinaryImageField
                  url={record.photo_url}
                  alt={getContactDisplayName(record)}
                  mode="avatar"
                />
              )}
              <div>
                <h2 className="text-xl md:text-2xl font-bold">
                  {getContactDisplayName(record)}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {isContactPrimaryForClient(record) ? (
                    <Badge variant="secondary">
                      Referente principale cliente
                    </Badge>
                  ) : null}
                  {roleLabel ? (
                    <Badge variant="outline">{roleLabel}</Badge>
                  ) : null}
                </div>
                {record.title ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="size-4" />
                    <span>{record.title}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
              <EditButton />
              <DeleteButton redirect="list" />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h6 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Contatti
              </h6>
              {getContactPrimaryEmail(record) ? (
                <InfoRow
                  icon={<Mail className="size-4" />}
                  value={getContactPrimaryEmail(record) ?? ""}
                />
              ) : null}
              {getContactPrimaryPhone(record) ? (
                <InfoRow
                  icon={<Phone className="size-4" />}
                  value={getContactPrimaryPhone(record) ?? ""}
                />
              ) : null}
              {record.linkedin_url ? (
                <InfoRow
                  icon={<Link2 className="size-4" />}
                  value={record.linkedin_url}
                />
              ) : null}
            </div>

            <div className="space-y-3">
              <h6 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Collegamenti CRM
              </h6>
              {client ? (
                <InfoRow
                  icon={<Building2 className="size-4" />}
                  label="Cliente"
                  value={client.name}
                  to={`/clients/${record.client_id}/show`}
                />
              ) : null}
              {supplier ? (
                <InfoRow
                  icon={<Building2 className="size-4" />}
                  label="Fornitore"
                  value={supplier.name}
                  to={`/suppliers/${record.supplier_id}/show`}
                />
              ) : null}
              {roleLabel ? (
                <InfoRow
                  icon={<Briefcase className="size-4" />}
                  label="Ruolo strutturato"
                  value={roleLabel}
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                {(projects ?? []).map((project) => (
                  <Badge key={project.id} variant="outline" asChild>
                    <Link to={`/projects/${project.id}/show`}>
                      {project.name}
                    </Link>
                  </Badge>
                ))}
              </div>
            </div>

            {record.background ? (
              <div className="space-y-3 md:col-span-2">
                <h6 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Note
                </h6>
                <p className="text-sm whitespace-pre-wrap">
                  {record.background}
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {record.id ? <ContactProjectLinksCard contactId={record.id} /> : null}
    </div>
  );
};

const ContactProjectLinksCard = ({
  contactId,
}: {
  contactId: Contact["id"];
}) => {
  const { data: links, isPending } = useGetList<ProjectContact>(
    "project_contacts",
    {
      filter: { "contact_id@eq": String(contactId) },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { enabled: !!contactId },
  );
  const projectIds = (links ?? []).map((link) => link.project_id);
  const { data: projects } = useGetMany<Project>(
    "projects",
    { ids: projectIds },
    { enabled: projectIds.length > 0 },
  );
  const [deleteOne, { isPending: isDeleting }] = useDelete();

  if (isPending) {
    return null;
  }

  const orderedLinks = [...(links ?? [])].sort((left, right) => {
    if (left.is_primary !== right.is_primary) {
      return left.is_primary ? -1 : 1;
    }

    return 0;
  });

  return (
    <Card>
      <CardContent>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Progetti collegati
        </h3>
        {!links?.length ? (
          <p className="text-sm text-muted-foreground">
            Nessun progetto collegato a questo referente.
          </p>
        ) : (
          <div className="space-y-2">
            {orderedLinks.map((link) => {
              const project = projects?.find(
                (item) => String(item.id) === String(link.project_id),
              );

              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <Link
                    to={`/projects/${link.project_id}/show`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {project?.name ?? "Progetto"}
                  </Link>
                  {link.is_primary ? (
                    <Badge variant="secondary">Primario progetto</Badge>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={isDeleting}
                    onClick={() =>
                      deleteOne(
                        "project_contacts",
                        { id: link.id, previousData: link },
                        { mutationMode: "pessimistic" },
                      )
                    }
                    aria-label="Rimuovi collegamento progetto"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const InfoRow = ({
  icon,
  label,
  value,
  to,
}: {
  icon: React.ReactNode;
  label?: string;
  value: string;
  to?: string;
}) => (
  <div className="flex items-center gap-2 text-sm">
    <span className="text-muted-foreground">{icon}</span>
    {label ? (
      <span className="font-medium text-muted-foreground">{label}:</span>
    ) : null}
    {to ? (
      <Link to={to} className="text-primary hover:underline">
        {value}
      </Link>
    ) : (
      <span>{value}</span>
    )}
  </div>
);

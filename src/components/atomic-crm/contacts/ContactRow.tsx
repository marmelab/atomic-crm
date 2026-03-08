import { Link } from "react-router";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";
import { User, Crown, Briefcase, Euro } from "lucide-react";
import { ListAvatar } from "../misc/ListAvatar";

import type { Contact } from "../types";
import { ListRowCheckbox } from "../misc/ListBulkSelection";
import {
  getContactDisplayName,
  getContactPrimaryEmail,
  getContactPrimaryPhone,
  getContactResolvedRole,
  getContactRoleLabel,
  isContactPrimaryForClient,
} from "./contactRecord";

const roleConfig: Record<
  string,
  { icon: LucideIcon; color: string; bg: string }
> = {
  amministrativo: {
    icon: Crown,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  operativo: {
    icon: Briefcase,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
  },
  fatturazione: {
    icon: Euro,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
  },
  referente: {
    icon: User,
    color: "text-slate-600",
    bg: "bg-slate-50 border-slate-200",
  },
};

const ContactIconAvatar = ({
  role,
  imageUrl,
}: {
  role: string;
  imageUrl?: string | null;
}) => {
  const config = roleConfig[role];
  return (
    <ListAvatar
      imageUrl={imageUrl}
      icon={config?.icon ?? User}
      iconColor={config?.color ?? "text-slate-500"}
      bgClass={config?.bg ?? "bg-slate-50 border-slate-200"}
    />
  );
};

export const ContactRow = ({
  contact,
  clientName,
  link,
  cv,
}: {
  contact: Contact;
  clientName?: string | null;
  link: string;
  cv: (key: string, extra?: string) => string | undefined;
}) => {
  const primaryEmail = getContactPrimaryEmail(contact);
  const primaryPhone = getContactPrimaryPhone(contact);
  const resolvedRole = getContactResolvedRole(contact);
  const roleLabel = getContactRoleLabel(resolvedRole);

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell className="w-10">
        <ListRowCheckbox id={contact.id} />
      </TableCell>
      <TableCell className={cv("name")}>
        <div className="flex items-start gap-3">
          <ContactIconAvatar role={resolvedRole} imageUrl={contact.photo_url} />
          <div className="space-y-1.5 min-w-0">
            <Link
              to={link}
              className="font-medium text-primary hover:underline block"
            >
              {getContactDisplayName(contact)}
            </Link>
            <div className="flex flex-wrap gap-1">
              {isContactPrimaryForClient(contact) ? (
                <Badge variant="secondary" className="text-[11px]">
                  Principale
                </Badge>
              ) : null}
              {roleLabel ? (
                <Badge variant="outline" className="text-[11px]">
                  {roleLabel}
                </Badge>
              ) : null}
              {primaryEmail ? (
                <Badge variant="outline" className="text-[11px]">
                  {primaryEmail}
                </Badge>
              ) : null}
              {primaryPhone ? (
                <Badge variant="outline" className="text-[11px]">
                  {primaryPhone}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className={cv("role", "text-muted-foreground")}>
        {[roleLabel, contact.title].filter(Boolean).join(" · ")}
      </TableCell>
      <TableCell
        className={cv(
          "contacts_info",
          "hidden md:table-cell text-muted-foreground",
        )}
      >
        {[primaryEmail, primaryPhone].filter(Boolean).join(" · ")}
      </TableCell>
      <TableCell
        className={cv("client", "hidden lg:table-cell text-muted-foreground")}
      >
        {clientName ?? ""}
      </TableCell>
    </TableRow>
  );
};

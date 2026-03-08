import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";

import type { Contact } from "../types";
import {
  getContactDisplayName,
  getContactPrimaryEmail,
  getContactPrimaryPhone,
  getContactResolvedRole,
  getContactRoleLabel,
  isContactPrimaryForClient,
} from "./contactRecord";

export const ContactMobileCard = ({
  contact,
  link,
}: {
  contact: Contact;
  link: string;
}) => {
  const roleLabel = getContactRoleLabel(getContactResolvedRole(contact));

  return (
    <Link
      to={link}
      className="flex flex-col gap-1 px-1 py-3 active:bg-muted/50"
    >
      <span className="text-base font-bold">
        {getContactDisplayName(contact)}
      </span>
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
      </div>
      {[
        contact.title,
        getContactPrimaryEmail(contact),
        getContactPrimaryPhone(contact),
      ].filter(Boolean).length > 0 ? (
        <span className="text-xs text-muted-foreground">
          {[
            contact.title,
            getContactPrimaryEmail(contact),
            getContactPrimaryPhone(contact),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      ) : null}
    </Link>
  );
};

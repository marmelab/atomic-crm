import type { ReactElement } from "react";
import { RecordsIterator, useTranslate } from "ra-core";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { SimpleListLoading } from "../simple-list/SimpleListLoading";
import { Avatar } from "../contacts/Avatar";
import type { Contact } from "../types";

export const DashboardContactList = ({
  data,
  empty = null,
  isPending,
  total,
}: {
  data?: Contact[];
  empty?: ReactElement | null;
  isPending?: boolean;
  total?: number;
}) => {
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const className = isMobile
    ? "divide-y [&_a]:px-0"
    : "[&>li:first-child>a]:rounded-t-xl [&>li:last-child>a]:rounded-b-xl";

  const content = isPending ? (
    <SimpleListLoading
      className={className}
      hasLeftAvatarOrIcon
      hasSecondaryText
    />
  ) : !data?.length ? (
    empty
  ) : (
    <ul className={className}>
      <RecordsIterator
        data={data}
        total={total}
        render={(contact) => (
          <li>
            <Link
              to={`/contacts/${contact.id}/show`}
              className="flex items-center gap-3 p-3 hover:bg-muted focus:bg-muted focus:outline-none"
            >
              <Avatar />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {contact.first_name} {contact.last_name}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {contact.title && contact.company_name
                    ? translate("resources.contacts.position_at_company", {
                        title: contact.title,
                        company: contact.company_name,
                      })
                    : contact.title || contact.company_name}
                </div>
              </div>
            </Link>
          </li>
        )}
      />
    </ul>
  );

  return isMobile ? content : <Card className="py-0">{content}</Card>;
};

import { useTranslate } from "ra-core";
import { Badge } from "@/components/ui/badge";

import type { Contact } from "../types";

// Surfaces the durable Contact-level Sales Eligibility gate (Native
// Applications repair pass, §3) — unmistakable but not alarming: an
// outline badge, same treatment weight as a Pending status elsewhere,
// never destructive-red on the Contact itself (that severity belongs to
// the moment of the Do Not Engage decision on the Application page, not
// to every subsequent view of this person).
export const DoNotEngageBadge = ({
  contact,
}: {
  contact: Pick<Contact, "sales_eligibility">;
}) => {
  const translate = useTranslate();
  if (contact.sales_eligibility !== "do_not_engage") return null;

  return (
    <Badge variant="outline" className="border-destructive text-destructive">
      {translate("resources.contacts.sales_eligibility.do_not_engage", {
        _: "Do Not Engage",
      })}
    </Badge>
  );
};

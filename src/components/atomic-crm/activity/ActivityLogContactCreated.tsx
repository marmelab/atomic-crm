import { Link } from "react-router";
import { useTranslate } from "ra-core";

import { ReferenceField } from "@/components/admin/reference-field";
import { Avatar } from "../contacts/Avatar";
import { RelativeDate } from "../misc/RelativeDate";
import { SaleName } from "../sales/SaleName";
import type { ActivityContactCreated } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";

type ActivityLogContactCreatedProps = {
  activity: ActivityContactCreated;
};

export function ActivityLogContactCreated({
  activity,
}: ActivityLogContactCreatedProps) {
  const translate = useTranslate();
  const context = useActivityLogContext();
  const { contact } = activity;
  return (
    <div className="p-0">
      <div className="flex flex-row gap-2 items-start w-full">
        <Avatar width={20} height={20} record={contact} />
        <span className="text-muted-foreground text-sm flex-grow">
          <ReferenceField source="sales_id" reference="sales" record={activity}>
            <SaleName />
          </ReferenceField>{" "}
          {translate("crm.activity.added_contact", { _: "added" })}{" "}
          <Link to={`/contacts/${contact.id}/show`}>
            {contact.first_name} {contact.last_name}
          </Link>
          {context !== "company" && (
            <>
              {activity.company_id != null && (
                <>
                  {" "}
                  {translate("crm.activity.to_company", { _: "to" })}{" "}
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    record={activity}
                    link="show"
                  />
                </>
              )}{" "}
              <RelativeDate date={activity.date} />
            </>
          )}
        </span>
        {context === "company" && (
          <span className="text-muted-foreground text-sm">
            <RelativeDate date={activity.date} />
          </span>
        )}
      </div>
    </div>
  );
}

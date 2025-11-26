import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { Avatar } from "../contacts/Avatar";
import { SaleName } from "../sales/SaleName";
import type { ActivityContactCreated } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";
import { ActivityLogHeader } from "./ActivityLogHeader";

type ActivityLogContactCreatedProps = {
  activity: ActivityContactCreated;
};

export function ActivityLogContactCreated({
  activity,
}: ActivityLogContactCreatedProps) {
  const context = useActivityLogContext();
  const { contact } = activity;
  return (
    <ActivityLogHeader
      avatar={<Avatar width={20} height={20} record={contact} />}
      activity={activity}
    >
      <ReferenceField
        source="sales_id"
        reference="sales"
        record={activity}
        className="inline-block"
      >
        <SaleName />
      </ReferenceField>
      &nbsp;added&nbsp;
      <Link to={`/contacts/${contact.id}/show`}>
        {contact.first_name}&nbsp;{contact.last_name}
      </Link>
      {context !== "company" && <>&nbsp;to company {activity.company_id}</>}
    </ActivityLogHeader>
  );
}

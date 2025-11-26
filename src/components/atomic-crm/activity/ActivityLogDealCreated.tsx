import { Link } from "react-router";
import type { RaRecord } from "ra-core";

import type { ActivityDealCreated } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";
import { ActivityLogHeader } from "./ActivityLogHeader";
import { ReferenceField } from "@/components/admin";
import { SaleName } from "../sales/SaleName";

type ActivityLogDealCreatedProps = {
  activity: RaRecord & ActivityDealCreated;
};

export function ActivityLogDealCreated({
  activity,
}: ActivityLogDealCreatedProps) {
  const context = useActivityLogContext();
  const { deal } = activity;
  return (
    <ActivityLogHeader
      avatar={<div className="w-5 h-5 bg-gray-300 rounded-full" />}
      activity={activity}
    >
      <span className="text-muted-foreground text-sm inline-flex">
        <ReferenceField source="sales_id" reference="sales" record={activity}>
          <SaleName />
        </ReferenceField>
      </span>
      &nbsp;added deal <Link to={`/deals/${deal.id}/show`}>{deal.name}</Link>
      {context !== "company" && (
        <>
          &nbsp;to company {activity.company_id}
        </>
      )}
    </ActivityLogHeader>
  );
}

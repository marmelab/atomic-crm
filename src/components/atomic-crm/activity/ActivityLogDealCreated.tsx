import { type RaRecord, useGetIdentity, useTranslate } from "ra-core";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { RelativeDate } from "../misc/RelativeDate";
import { useGetSalesName } from "../sales/useGetSalesName";
import type { ActivityDealCreated } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";
import { useIsMobile } from "@/hooks/use-mobile";

type ActivityLogDealCreatedProps = {
  activity: RaRecord & ActivityDealCreated;
};

export function ActivityLogDealCreated({
  activity,
}: ActivityLogDealCreatedProps) {
  const context = useActivityLogContext();
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const { deal } = activity;
  const { identity, isPending } = useGetIdentity();
  const isCurrentUser = !isPending && identity?.id === activity.sales_id;
  const salesName = useGetSalesName(activity.sales_id, {
    enabled: !isCurrentUser,
  });
  return (
    <div className="p-0">
      <div className="flex flex-row gap-2 items-start w-full">
        <div className="w-[20px] h-[20px] bg-gray-300 rounded-full shrink-0" />
        <span className="text-muted-foreground text-sm flex-grow">
          {translate(
            isCurrentUser
              ? "crm.activity.you_added_deal"
              : "crm.activity.added_deal",
            { name: salesName },
          )}{" "}
          {isMobile ? (
            deal.name
          ) : (
            <Link to={`/deals/${deal.id}/show`}>{deal.name}</Link>
          )}{" "}
          {context !== "company" && (
            <>
              {translate("crm.activity.to")}{" "}
              <ReferenceField
                source="company_id"
                reference="companies"
                record={activity}
                link="show"
              />{" "}
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

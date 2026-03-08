import { useGetIdentity, useTranslate } from "ra-core";
import { Link } from "react-router";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { useGetSalesName } from "../sales/useGetSalesName";
import { RelativeDate } from "../misc/RelativeDate";
import type { ActivityCompanyCreated } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";

type ActivityLogCompanyCreatedProps = {
  activity: ActivityCompanyCreated;
};

export function ActivityLogCompanyCreated({
  activity,
}: ActivityLogCompanyCreatedProps) {
  const context = useActivityLogContext();
  const translate = useTranslate();
  const { identity, isPending } = useGetIdentity();
  const { company } = activity;
  const isCurrentUser = !isPending && identity?.id === activity.sales_id;
  const salesName = useGetSalesName(activity.sales_id, {
    enabled: !isCurrentUser,
  });
  return (
    <div className="p-0">
      <div className="flex flex-row gap-2 items-start w-full">
        <CompanyAvatar width={20} height={20} record={company} />

        <span className="text-muted-foreground text-sm flex-grow">
          {translate(
            isCurrentUser
              ? "crm.activity.you_added_company"
              : "crm.activity.added_company",
            { name: salesName },
          )}{" "}
          <Link to={`/companies/${company.id}/show`}>{company.name}</Link>
          {context === "all" && (
            <>
              {" "}
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

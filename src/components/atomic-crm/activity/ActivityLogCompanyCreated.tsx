import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { RelativeDate } from "../misc/RelativeDate";
import { SaleName } from "../sales/SaleName";
import type { ActivityCompanyCreated } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";

type ActivityLogCompanyCreatedProps = {
  activity: ActivityCompanyCreated;
};

export function ActivityLogCompanyCreated({
  activity,
}: ActivityLogCompanyCreatedProps) {
  const context = useActivityLogContext();
  const { company } = activity;
  return (
    <div className="p-0">
      <div className="flex flex-row space-x-1 items-center w-full">
        <CompanyAvatar width={20} height={20} record={company} />

        <span className="text-muted-foreground text-sm inline-flex flex-grow">
          <ReferenceField source="sales_id" reference="sales" record={activity}>
            <SaleName />
          </ReferenceField>
          &nbsp;added company&nbsp;
          <Link to={`/companies/${company.id}/show`}>{company.name}</Link>
          {context === "all" && (
            <>
              &nbsp;
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

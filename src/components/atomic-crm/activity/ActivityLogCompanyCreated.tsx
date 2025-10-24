import { Link } from "react-router";
import { ReferenceField } from "@/components/admin";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { RelativeDate } from "@/components/atomic-crm/misc/RelativeDate";
import { SaleName } from "@/components/atomic-crm/sales/SaleName";
import type { ActivityCompanyCreated } from "@/components/atomic-crm/types";
import { useActivityLogContext } from "@/components/atomic-crm/activity/ActivityLogContext";

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

        <div className="text-sm text-muted-foreground flex-grow">
          <span className="text-muted-foreground text-sm inline-flex">
            <ReferenceField
              source="sales_id"
              reference="sales"
              record={activity}
            >
              <SaleName />
            </ReferenceField>
          </span>
          &nbsp;added company &nbsp;
          <Link to={`/companies/${company.id}/show`}>{company.name}</Link>
          {context === "all" && (
            <>
              <RelativeDate date={activity.date} />
            </>
          )}
        </div>
        {context === "company" && (
          <span className="text-muted-foreground text-sm">
            <RelativeDate date={activity.date} />
          </span>
        )}
      </div>
    </div>
  );
}

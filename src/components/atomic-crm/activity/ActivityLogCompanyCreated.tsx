import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { SaleName } from "../sales/SaleName";
import type { ActivityCompanyCreated } from "../types";
import { ActivityLogHeader } from "./ActivityLogHeader";

type ActivityLogCompanyCreatedProps = {
  activity: ActivityCompanyCreated;
};

export function ActivityLogCompanyCreated({
  activity,
}: ActivityLogCompanyCreatedProps) {
  const { company } = activity;
  return (
    <ActivityLogHeader
      avatar={<CompanyAvatar width={20} height={20} record={company} />}
      activity={activity}
    >
      <span className="text-muted-foreground text-sm inline-flex">
        <ReferenceField source="sales_id" reference="sales" record={activity}>
          <SaleName />
        </ReferenceField>
      </span>
      &nbsp;added company &nbsp;
      <Link to={`/companies/${company.id}/show`}>{company.name}</Link>
    </ActivityLogHeader>
  );
}

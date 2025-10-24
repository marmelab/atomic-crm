import { ReferenceField } from "@/components/admin";
import type { RaRecord } from "ra-core";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { RelativeDate } from "@/components/atomic-crm/misc/RelativeDate";
import { SaleName } from "@/components/atomic-crm/sales/SaleName";
import type { ActivityDealNoteCreated } from "@/components/atomic-crm/types";
import { useActivityLogContext } from "@/components/atomic-crm/activity/ActivityLogContext";
import { ActivityLogNote } from "@/components/atomic-crm/activity/ActivityLogNote";

type ActivityLogDealNoteCreatedProps = {
  activity: RaRecord & ActivityDealNoteCreated;
};

export function ActivityLogDealNoteCreated({
  activity,
}: ActivityLogDealNoteCreatedProps) {
  const context = useActivityLogContext();
  const { dealNote } = activity;
  return (
    <ActivityLogNote
      header={
        <div className="flex flex-row items-center gap-2 flex-grow">
          <ReferenceField
            source="deal_id"
            reference="deals"
            record={dealNote}
            link={false}
          >
            <ReferenceField
              source="company_id"
              reference="companies"
              link={false}
            >
              <CompanyAvatar width={20} height={20} />
            </ReferenceField>
          </ReferenceField>

          <span className="text-sm text-muted-foreground flex-grow inline-flex">
            <ReferenceField
              source="sales_id"
              reference="sales"
              record={activity}
              link={false}
            >
              <SaleName />
            </ReferenceField>
            &nbsp;added a note about deal&nbsp;
            <ReferenceField
              source="deal_id"
              reference="deals"
              record={dealNote}
              link="show"
            />
            {context !== "company" && (
              <>
                {" at "}
                <ReferenceField
                  source="deal_id"
                  reference="deals"
                  record={dealNote}
                  link={false}
                >
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link="show"
                  />
                </ReferenceField>{" "}
              </>
            )}
          </span>

          {context === "company" && (
            <span className="text-muted-foreground text-sm">
              <RelativeDate date={activity.date} />
            </span>
          )}
        </div>
      }
      text={dealNote.text}
    />
  );
}

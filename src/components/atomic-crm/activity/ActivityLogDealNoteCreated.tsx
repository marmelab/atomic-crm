import type { RaRecord } from "ra-core";

import { ReferenceField } from "@/components/admin/reference-field";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { SaleName } from "../sales/SaleName";
import type { ActivityDealNoteCreated } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";
import { ActivityLogNote } from "./ActivityLogNote";
import { ActivityLogHeader } from "./ActivityLogHeader";

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
        <ActivityLogHeader
          avatar={
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
          }
          activity={activity}
        >
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
            className="inline-block"
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
        </ActivityLogHeader>
      }
      text={dealNote.text}
    />
  );
}

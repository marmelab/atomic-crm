import { type RaRecord, useGetIdentity, useTranslate } from "ra-core";

import { ReferenceField } from "@/components/admin/reference-field";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { RelativeDate } from "../misc/RelativeDate";
import { useGetSalesName } from "../sales/useGetSalesName";
import type { ActivityDealNoteCreated } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";
import { ActivityLogNote } from "./ActivityLogNote";
import { useIsMobile } from "@/hooks/use-mobile";

type ActivityLogDealNoteCreatedProps = {
  activity: RaRecord & ActivityDealNoteCreated;
};

export function ActivityLogDealNoteCreated({
  activity,
}: ActivityLogDealNoteCreatedProps) {
  const context = useActivityLogContext();
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const { dealNote } = activity;
  const isCurrentUser = activity.sales_id === identity?.id;
  const salesName = useGetSalesName(activity.sales_id, {
    enabled: !isCurrentUser,
  });
  return (
    <ActivityLogNote
      header={
        <div className="flex flex-row items-start gap-2 flex-grow">
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

          <span className="text-muted-foreground text-sm flex-grow">
            {translate(
              isCurrentUser
                ? "crm.activity.you_added_note_about_deal"
                : "crm.activity.added_note_about_deal",
              { name: salesName },
            )}{" "}
            <ReferenceField
              source="deal_id"
              reference="deals"
              record={dealNote}
              link={isMobile ? false : "show"}
            />
            {context !== "company" && (
              <>
                {" "}
                {translate("crm.common.at")}{" "}
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
      }
      text={dealNote.text}
      link={isMobile ? false : `/deals/${dealNote.deal_id}/show`}
    />
  );
}

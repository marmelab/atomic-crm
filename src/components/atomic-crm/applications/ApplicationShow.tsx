import { Check, X } from "lucide-react";
import {
  useNotify,
  useRecordContext,
  useRefresh,
  useTranslate,
  useUpdate,
} from "ra-core";
import { DateField } from "@/components/admin/date-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { RecordField } from "@/components/admin/record-field";
import { Show } from "@/components/admin/show";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Application } from "../types";
import { applicationStatusLabels } from "./applicationConstants";

export const ApplicationShow = () => (
  <Show actions={false}>
    <div className="flex flex-col gap-4">
      <RecordField label="resources.applications.fields.contact">
        <ReferenceField source="opportunity_id" reference="deals" link={false}>
          <ReferenceField
            source="contact_id"
            reference="contacts"
            link="show"
          />
        </ReferenceField>
      </RecordField>
      <RecordField label="resources.applications.fields.offer">
        <ReferenceField source="opportunity_id" reference="deals" link={false}>
          <ReferenceField source="offer_id" reference="offers" link={false} />
        </ReferenceField>
      </RecordField>
      <RecordField label="resources.applications.fields.cohort">
        <ReferenceField source="opportunity_id" reference="deals" link={false}>
          <ReferenceField
            source="cohort_id"
            reference="cohorts"
            link={false}
            empty=""
          />
        </ReferenceField>
      </RecordField>
      <RecordField label="resources.applications.fields.opportunity">
        <ReferenceField source="opportunity_id" reference="deals" link="show" />
      </RecordField>
      <RecordField label="resources.applications.fields.submitted_at">
        <DateField source="submitted_at" showTime />
      </RecordField>
      <RecordField label="resources.applications.fields.status">
        <StatusRow />
      </RecordField>
      <RecordField source="summary" />
      <RawAnswers />
    </div>
  </Show>
);

const StatusRow = () => {
  const record = useRecordContext<Application>();
  const translate = useTranslate();
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  if (!record) return null;

  const setStatus = (status: Application["status"]) => {
    update(
      "applications",
      {
        id: record.id,
        data: { status, reviewed_at: new Date().toISOString() },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify("resources.applications.updated", { type: "info" });
          refresh();
        },
      },
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={record.status === "pending" ? "outline" : "secondary"}>
        {applicationStatusLabels[record.status]}
      </Badge>
      {record.status === "pending" && (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => setStatus("approved")}
          >
            <Check className="w-4 h-4" />
            {translate("resources.applications.action.approve")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => setStatus("rejected")}
          >
            <X className="w-4 h-4" />
            {translate("resources.applications.action.reject")}
          </Button>
        </>
      )}
    </div>
  );
};

const RawAnswers = () => {
  const record = useRecordContext<Application>();
  const translate = useTranslate();
  if (!record || !record.raw_answers) return null;
  const entries = Object.entries(record.raw_answers);
  if (!entries.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground tracking-wide">
        {translate("resources.applications.fields.raw_answers")}
      </span>
      <dl className="flex flex-col gap-2 text-sm">
        {entries.map(([question, answer]) => (
          <div key={question}>
            <dt className="text-muted-foreground">{question}</dt>
            <dd>{String(answer)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

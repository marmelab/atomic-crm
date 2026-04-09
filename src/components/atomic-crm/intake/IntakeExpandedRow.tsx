import type { ReactNode } from "react";
import { useTranslate } from "ra-core";
import type { IntakeLead } from "../types";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="space-y-2">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </h4>
    <div className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
      {children}
    </div>
  </section>
);

export const IntakeExpandedRow = ({ record }: { record: IntakeLead }) => {
  const translate = useTranslate();
  const hasLocation = Boolean(record.address || record.city || record.region);
  const hasDetails = Boolean(
    record.enrichment_summary ||
      record.outreach_draft ||
      record.notes ||
      hasLocation,
  );

  if (!hasDetails) {
    return (
      <div className="text-sm text-muted-foreground">
        {translate("resources.intake_leads.expanded.no_details", {
          _: "No additional details yet.",
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border bg-muted/20 p-4">
      {record.enrichment_summary ? (
        <Section title={translate("resources.intake_leads.expanded.enrichment", { _: "AI Enrichment" })}>
          {record.enrichment_summary}
        </Section>
      ) : null}

      {record.outreach_draft ? (
        <Section title={translate("resources.intake_leads.expanded.outreach", { _: "Outreach Draft" })}>
          {record.outreach_draft}
        </Section>
      ) : null}

      {hasLocation ? (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {translate("resources.intake_leads.expanded.location", { _: "Location" })}
          </h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            {record.address ? <div>{record.address}</div> : null}
            {record.city || record.region ? (
              <div>
                {[record.city, record.region].filter(Boolean).join(", ")}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {record.notes ? (
        <Section title={translate("resources.intake_leads.expanded.notes", { _: "Notes" })}>
          {record.notes}
        </Section>
      ) : null}
    </div>
  );
};

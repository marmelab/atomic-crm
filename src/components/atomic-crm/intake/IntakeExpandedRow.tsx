import type { ReactNode } from "react";
import { useTranslate } from "ra-core";
import { cn } from "@/lib/utils";
import type { IntakeLead } from "../types";

const OUTREACH_CADENCE = [
  { day: 1, label: "Day 1", type: "Email" },
  { day: 3, label: "Day 3", type: "Call" },
  { day: 4, label: "Day 4", type: "Email" },
  { day: 7, label: "Day 7", type: "Call" },
  { day: 14, label: "Day 14", type: "Email" },
  { day: 21, label: "Day 21", type: "Call" },
  { day: 28, label: "Day 28", type: "Email" },
];

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

      {record.outreach_sequence_step > 0 || record.status === "in-sequence" ? (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Outreach Cadence
          </h4>
          <div className="flex items-center gap-1">
            {OUTREACH_CADENCE.map((touch, i) => {
              const completed = i < record.outreach_sequence_step;
              const current = i === record.outreach_sequence_step && record.status === "in-sequence";
              return (
                <div key={touch.day} className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors",
                      completed
                        ? "bg-green-500 border-green-500 text-white"
                        : current
                          ? "bg-amber-100 border-amber-500 text-amber-700"
                          : "bg-muted border-border text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{touch.type}</span>
                  {i < OUTREACH_CADENCE.length - 1 && (
                    <div className="hidden" />
                  )}
                </div>
              );
            })}
          </div>
          {record.last_outreach_at && (
            <p className="text-xs text-muted-foreground">
              Last outreach: {new Date(record.last_outreach_at).toLocaleDateString()}
              {record.next_outreach_date && (
                <> &middot; Next: {new Date(record.next_outreach_date).toLocaleDateString()}</>
              )}
            </p>
          )}
        </section>
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

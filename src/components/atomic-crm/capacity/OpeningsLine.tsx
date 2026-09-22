import { useTranslate } from "ra-core";

import type { OpeningsAnswer } from "./occupancyLedger";

// "3 openings" — or an honest admission that the question has no answer
// yet.
//
// Openings stopped being a plain number when they became a ledger result,
// and the cards did not notice: they interpolated the answer OBJECT into
// "%{count} openings" and rendered "[object Object] openings" on the
// dashboard. The deeper reason the shape changed is worth keeping in one
// place rather than two — a practice whose Year Tracking calendar does not
// reach far enough to seat a new client's twelve session weeks has no
// openings COUNT at all, and printing "0 openings" for it would say the
// practice is full when it is merely unscheduled. Both program cards ask
// this component, so the dashboard and the Programs hub cannot answer
// differently.
export const OpeningsLine = ({
  openings,
  // A page header is already a sentence; a <p> inside one is invalid and
  // breaks the line. Same words either way.
  inline = false,
}: {
  openings: OpeningsAnswer;
  inline?: boolean;
}) => {
  const translate = useTranslate();
  const Wrapper = inline ? "span" : "p";
  const className = inline ? undefined : "text-sm text-muted-foreground";

  if (openings.status === "unknown") {
    return (
      <Wrapper className={className}>
        {translate("crm.dashboard.capacity_openings_unknown", {
          _: "Openings unknown — only %{scheduled} of %{required} session weeks scheduled",
          scheduled: openings.weeksScheduled,
          required: openings.weeksRequired,
        })}
      </Wrapper>
    );
  }

  return (
    <Wrapper className={className}>
      {translate("crm.dashboard.capacity_openings", {
        _: "%{count} openings",
        count: openings.openings,
      })}
    </Wrapper>
  );
};

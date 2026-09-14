import { Draggable } from "@hello-pangea/dnd";
import { useGetList, useRedirect, RecordContextProvider } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { NumberField } from "@/components/admin/number-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, SalesCall } from "../types";

export const DealCard = ({ deal, index }: { deal: Deal; index: number }) => {
  if (!deal) return null;

  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <DealCardContent provided={provided} snapshot={snapshot} deal={deal} />
      )}
    </Draggable>
  );
};

export const DealCardContent = ({
  provided,
  snapshot,
  deal,
}: {
  provided?: any;
  snapshot?: any;
  deal: Deal;
}) => {
  const { currency } = useConfigurationContext();
  const redirect = useRedirect();
  const handleClick = () => {
    redirect(`/deals/${deal.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  return (
    <div
      className="cursor-pointer"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
    >
      <RecordContextProvider value={deal}>
        <Card
          className={`py-3 transition-all duration-200 ${
            snapshot?.isDragging
              ? "opacity-90 transform rotate-1 shadow-lg"
              : "shadow-sm hover:shadow-md"
          }`}
        >
          <CardContent className="px-3 flex flex-col">
            <div className="flex-1 flex items-center gap-2">
              <p className="flex-1 text-sm font-medium mb-0">
                <ReferenceField
                  source="contact_id"
                  reference="contacts"
                  link={false}
                />
              </p>
              {deal.stage === "call_booked" && (
                <SalesCallNoShowBadge opportunityId={deal.id} />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {/* What they're applying for, alongside the value (Native
                  Application Intake acceptance-repair pass, round 2): the
                  card previously showed only name + amount, with no way to
                  tell a Living Example card from a Growing Yourself Up one
                  at a glance. offers' own recordRepresentation is "name"
                  (offers/index.ts), so this renders the real offer display
                  name — never an internal code. Cohort identity isn't
                  added here for GYU (out of scope for this small pass —
                  the offer name alone already answers "what are they
                  applying for"); DealShow.tsx remains the place for full
                  Offer + Cohort detail. */}
              <ReferenceField
                source="offer_id"
                reference="offers"
                link={false}
              />
              {" · "}
              <NumberField
                source="amount"
                options={{
                  notation: "compact",
                  style: "currency",
                  currency,
                  currencyDisplay: "narrowSymbol",
                  minimumSignificantDigits: 3,
                }}
              />
            </p>
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};

// Go-Live Blocker: Sales-Call No-Show/Rebooking slice — the smallest
// useful Kanban-visibility fix: a Call Booked card whose latest Sales
// Call concluded as a no-show looked identical to one with a genuinely
// upcoming call, so a stranded Opportunity was invisible without opening
// it. Sorted by id DESC (same convention as DealSalesCallSection.tsx) so
// a fresh rebooking's new row — attendance null — naturally wins over the
// old concluded one and the badge correctly disappears; no separate
// "is there a newer booking" check needed.
const SalesCallNoShowBadge = ({
  opportunityId,
}: {
  opportunityId: Deal["id"];
}) => {
  const { data: salesCalls } = useGetList<SalesCall>("sales_calls", {
    filter: { opportunity_id: opportunityId },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "DESC" },
  });
  if (salesCalls?.[0]?.attendance !== "no_show") return null;
  return (
    <Badge variant="destructive" className="shrink-0">
      No-show
    </Badge>
  );
};

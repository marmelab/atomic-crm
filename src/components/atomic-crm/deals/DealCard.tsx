import { Draggable } from "@hello-pangea/dnd";
import { useGetList, useRedirect, RecordContextProvider } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import type { Deal, SalesCall } from "../types";
import { usePostSaleSetup } from "./postSaleSetupContext";

export const DealCard = ({ deal, index }: { deal: Deal; index: number }) => {
  if (!deal) return null;

  return (
    // A sold Opportunity sitting in Onboarding is not dragged anywhere: it
    // leaves the board by having its setup finished. Dragging one would
    // silently rewrite the sale.
    <Draggable
      draggableId={String(deal.id)}
      index={index}
      isDragDisabled={deal.stage === "won"}
    >
      {(provided, snapshot) => (
        <DealCardContent provided={provided} snapshot={snapshot} deal={deal} />
      )}
    </Draggable>
  );
};

// The one thing still standing between this sale and the client being set
// up — "Payment setup pending", "Contract pending". One line, because the
// card has to be readable at a glance; the full checklist is in the drawer.
const PostSaleBlockerLine = ({ deal }: { deal: Deal }) => {
  const setup = usePostSaleSetup(deal.id);
  if (!setup?.headline) return null;
  return (
    <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 truncate">
      {setup.headline}
      {setup.blockers.length > 1 && ` +${setup.blockers.length - 1} more`}
    </p>
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
              {/* What they are applying for. Money deliberately does NOT
                  appear here: the Pipeline is an operational workflow —
                  who needs what done next — not a revenue forecast, and a
                  "$4.00K" on every card read as a running total Leif was
                  meant to act on. The commercial terms still live in the
                  Opportunity drawer, where they answer a real question.
                  Nothing stored is removed. */}
              <ReferenceField
                source="offer_id"
                reference="offers"
                link={false}
              />
            </p>
            <PostSaleBlockerLine deal={deal} />
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

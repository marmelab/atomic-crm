import { ReferenceField } from "@/components/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Draggable } from "@hello-pangea/dnd";
import { useRedirect } from "ra-core";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import type { Deal } from "../types";

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
      <Card
        className={`py-4 transition-all duration-200 ${
          snapshot?.isDragging
            ? "opacity-90 transform rotate-1 shadow-lg"
            : "shadow-sm hover:shadow-md"
        }`}
      >
        <CardContent className="px-4 flex">
          <ReferenceField
            source="company_id"
            record={deal}
            reference="companies"
            link={false}
          >
            <CompanyAvatar width={20} height={20} />
          </ReferenceField>
          <div className="ml-3">
            <p className="text-sm font-medium mb-2">{deal.name}</p>
            <p className="text-xs text-muted-foreground">
              {deal.amount.toLocaleString("en-US", {
                notation: "compact",
                style: "currency",
                currency: "USD",
                currencyDisplay: "narrowSymbol",
                minimumSignificantDigits: 3,
              })}
              {deal.category ? `, ${deal.category}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

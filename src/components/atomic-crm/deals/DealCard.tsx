import { Draggable } from "@hello-pangea/dnd";
import { useRedirect, RecordContextProvider, useTranslate } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { NumberField } from "@/components/admin/number-field";
import { SelectField } from "@/components/admin/select-field";
import { Card, CardContent } from "@/components/ui/card";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { getDealExpectedValue } from "./dealUtils";

function DealConfidenceDots({ level }: { level?: number | null }) {
  const translate = useTranslate();
  const tier =
    level === 1 ? "cold" : level === 2 ? "warm" : level === 3 ? "hot" : null;
  const filledCount =
    level != null && level >= 1 && level <= 3 ? level : 0;
  const tooltipKey =
    tier == null
      ? "resources.deals.temperature.tooltip_unset"
      : tier === "cold"
        ? "resources.deals.temperature.tooltip_cold"
        : tier === "warm"
          ? "resources.deals.temperature.tooltip_warm"
          : "resources.deals.temperature.tooltip_hot";

  return (
    <div
      className="confidence-dots flex flex-row items-center gap-1 mb-1.5"
      title={translate(tooltipKey)}
    >
      {[0, 1, 2].map((i) => {
        const filled = i < filledCount;
        return (
          <span
            key={i}
            className={`dot h-2 w-2 shrink-0 rounded-[9999px] ${filled ? `filled ${tier}` : "empty"}`}
            style={
              filled
                ? {
                    backgroundColor:
                      tier === "cold"
                        ? "var(--color-text-faint)"
                        : tier === "warm"
                          ? "var(--color-gold)"
                          : "var(--color-success)",
                  }
                : {
                    backgroundColor: "var(--color-border)",
                  }
            }
          />
        );
      })}
    </div>
  );
}

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
  const { dealCategories, currency, dealStages } = useConfigurationContext();
  const expectedValue = getDealExpectedValue(
    deal.amount,
    deal.stage,
    dealStages,
  );
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
            <DealConfidenceDots level={deal.temperature_level} />
            <div className="flex-1 flex">
              <p className="flex-1 text-sm font-medium mb-2 company-name">
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  link={false}
                />
                {" - "}
                {deal.name}
              </p>
              <ReferenceField
                source="company_id"
                reference="companies"
                link={false}
              >
                <CompanyAvatar width={20} height={20} />
              </ReferenceField>
            </div>
            <p className="text-xs text-muted-foreground">
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
              {deal.category && ", "}
              <SelectField
                source="category"
                choices={dealCategories}
                optionText="label"
                optionValue="value"
              />
              <span>
                {" "}
                (Expected:{" "}
                {expectedValue.toLocaleString("en-US", {
                  notation: "compact",
                  style: "currency",
                  currency,
                  currencyDisplay: "narrowSymbol",
                  minimumSignificantDigits: 3,
                })}
                )
              </span>
            </p>
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};

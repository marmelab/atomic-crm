import { useState } from "react";
import { RecordContextProvider, useListContext } from "ra-core";
import { ChevronDown } from "lucide-react";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { IntakeLead } from "../types";
import { IntakeExpandedRow } from "./IntakeExpandedRow";
import { IntakePromoteButton } from "./IntakePromoteButton";
import { IntakeRejectButton } from "./IntakeRejectButton";
import { IntakeStatusBadge } from "./IntakeStatusBadge";

export const IntakeMobileList = () => {
  const { data = [] } = useListContext<IntakeLead>();
  const [expandedIds, setExpandedIds] = useState<Array<IntakeLead["id"]>>([]);

  const toggleExpanded = (id: IntakeLead["id"]) => {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((expandedId) => expandedId !== id)
        : [...current, id],
    );
  };

  return (
    <div className="space-y-3">
      {data.map((record) => {
        const expanded = expandedIds.includes(record.id);

        return (
          <RecordContextProvider key={record.id} value={record}>
            <Card className="gap-0 overflow-hidden py-0">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => toggleExpanded(record.id)}
              >
                <CardHeader className="gap-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <CardTitle className="truncate text-base font-semibold">
                        {record.business_name}
                      </CardTitle>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div>
                          <ReferenceField
                            source="trade_type_id"
                            reference="trade_types"
                            link={false}
                            empty={<span>Unknown trade type</span>}
                          >
                            <TextField source="name" />
                          </ReferenceField>
                        </div>
                        <div>{record.city || "Unknown city"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <IntakeStatusBadge status={record.status} />
                      <ChevronDown
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </div>
                  </div>
                </CardHeader>
              </button>

              {expanded ? (
                <CardContent className="px-4 pb-4">
                  <IntakeExpandedRow record={record} />
                </CardContent>
              ) : null}

              <CardFooter className="justify-end gap-2 border-t px-4 py-4">
                <IntakePromoteButton record={record} />
                <IntakeRejectButton record={record} />
              </CardFooter>
            </Card>
          </RecordContextProvider>
        );
      })}
    </div>
  );
};

import { ArrowRight, Globe2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type {
  CustomerPerformanceCategory,
  CustomerVisibilityRow,
} from "../types";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  categoryBadgeClass,
  dataBasisLabel,
} from "./customerVisibilityUi";

export function CustomerPerformanceMap({
  rows,
  onSelect,
}: {
  rows: CustomerVisibilityRow[];
  onSelect: (row: CustomerVisibilityRow) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kundkarta</CardTitle>
        <p className="text-sm text-muted-foreground">
          Kundernas placering bygger på verifierad utveckling, teknisk hälsa,
          sidupplevelse och datatäckning.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 xl:grid-cols-5">
          {CATEGORY_ORDER.map((category) => (
            <CategoryColumn
              key={category}
              category={category}
              rows={rows.filter((row) => row.category === category)}
              onSelect={onSelect}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryColumn({
  category,
  rows,
  onSelect,
}: {
  category: CustomerPerformanceCategory;
  rows: CustomerVisibilityRow[];
  onSelect: (row: CustomerVisibilityRow) => void;
}) {
  return (
    <section className="min-w-0 rounded-lg border bg-muted/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge className={categoryBadgeClass(category)}>
          {CATEGORY_LABELS[category]}
        </Badge>
        <span className="text-sm font-semibold tabular-nums">{rows.length}</span>
      </div>
      <div className="space-y-2">
        {rows.length ? (
          rows.map((row) => (
            <Button
              key={row.companyId}
              type="button"
              variant="outline"
              onClick={() => onSelect(row)}
              className="h-auto w-full justify-start whitespace-normal bg-background p-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Globe2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-semibold">
                    {row.companyName}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-normal text-muted-foreground">
                  {row.reasons[0]?.label ?? "Ingen förklaring tillgänglig"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-normal text-muted-foreground">
                  <span>{dataBasisLabel(row.dataBasis)}</span>
                  {row.currentSnapshot?.performance_score != null ? (
                    <span>
                      · Prestanda {row.currentSnapshot.performance_score}
                    </span>
                  ) : null}
                  {row.currentSnapshot?.seo_score != null ? (
                    <span>· SEO {row.currentSnapshot.seo_score}</span>
                  ) : null}
                </div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          ))
        ) : (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Inga kunder i kategorin
          </p>
        )}
      </div>
    </section>
  );
}

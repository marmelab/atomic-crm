import { ArrowUpDown, Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { CustomerVisibilityRow } from "../types";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  dataBasisLabel,
  formatMetric,
  REPORT_STATUS_LABELS,
  reportBadgeClass,
} from "./customerVisibilityUi";

export type CustomerTableSort =
  | "category"
  | "company"
  | "clicks"
  | "position";

export function CustomerVisibilityTable({
  rows,
  sort,
  onSort,
  onSelect,
}: {
  rows: CustomerVisibilityRow[];
  sort: CustomerTableSort;
  onSort: (sort: CustomerTableSort) => void;
  onSelect: (row: CustomerVisibilityRow) => void;
}) {
  return (
    <Card className="hidden lg:flex">
      <CardHeader>
        <CardTitle>Jämför alla kundwebbplatser</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Kund"
                active={sort === "company"}
                onClick={() => onSort("company")}
              />
              <SortableHead
                label="Kategori"
                active={sort === "category"}
                onClick={() => onSort("category")}
              />
              <SortableHead
                label="Google-klick"
                active={sort === "clicks"}
                onClick={() => onSort("clicks")}
              />
              <TableHead>Visningar / CTR</TableHead>
              <SortableHead
                label="Position"
                active={sort === "position"}
                onClick={() => onSort("position")}
              />
              <TableHead>Prestanda / CWV</TableHead>
              <TableHead>Datatäckning</TableHead>
              <TableHead>Rapport</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Visa</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const metrics = row.viewModel?.metrics;
              const field = row.currentSnapshot?.field_data;
              return (
                <TableRow key={row.companyId}>
                  <TableCell>
                    <p className="font-medium">{row.companyName}</p>
                    <p className="max-w-48 truncate text-xs text-muted-foreground">
                      {row.websiteUrl}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dataBasisLabel(row.dataBasis)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge className={categoryBadgeClass(row.category)}>
                      {CATEGORY_LABELS[row.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatMetric(metrics?.clicks, "number")}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <p>{formatMetric(metrics?.impressions, "number")}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMetric(metrics?.ctr, "percent")}
                    </p>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatMetric(metrics?.position, "decimal", true)}
                  </TableCell>
                  <TableCell>
                    <p className="tabular-nums">
                      {row.currentSnapshot?.performance_score == null
                        ? "Saknas"
                        : `${row.currentSnapshot.performance_score}/100`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {field
                        ? [field.lcp_rating, field.inp_rating, field.cls_rating]
                            .filter(Boolean)
                            .every((rating) => rating === "GOOD")
                          ? "CWV: bra"
                          : "CWV: behöver ses över"
                        : "CWV saknas"}
                    </p>
                  </TableCell>
                  <TableCell>
                    {row.viewModel
                      ? `${row.viewModel.coverage.available}/${row.viewModel.coverage.total}`
                      : "Saknas"}
                  </TableCell>
                  <TableCell>
                    <Badge className={reportBadgeClass(row.reportStatus)}>
                      {REPORT_STATUS_LABELS[row.reportStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onSelect(row)}
                    >
                      <Eye className="size-4" />
                      <span className="sr-only">Visa {row.companyName}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!rows.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Inga kunder matchar filtreringen.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SortableHead({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={onClick}
      >
        {label}
        <ArrowUpDown
          className={active ? "size-3.5 text-foreground" : "size-3.5"}
        />
      </Button>
    </TableHead>
  );
}

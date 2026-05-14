// src/components/atomic-crm/time-billing/TimePage.tsx
import { useMemo } from "react";
import { useGetList } from "ra-core";
import { Clock, TrendingUp, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

import type { Company, Invoice, TimeEntry } from "../types";
import { formatSZL } from "@/lib/format";
import { LogTimeDialog } from "./LogTimeDialog";
import { TimeList } from "./TimeList";
import { InvoiceList } from "./InvoiceList";

export const TimePage = () => {
  const { data: entries = [] } = useGetList<TimeEntry>("time_entries", {
    pagination: { page: 1, perPage: 10000 },
    sort: { field: "entry_date", order: "DESC" },
  });

  const { data: invoices = [] } = useGetList<Invoice>("invoices", {
    pagination: { page: 1, perPage: 10000 },
    sort: { field: "created_at", order: "DESC" },
  });

  const { data: companiesData = [] } = useGetList<Company>("companies", {
    pagination: { page: 1, perPage: 10000 },
    sort: { field: "name", order: "ASC" },
  });

  const companies = useMemo(
    () =>
      Object.fromEntries(companiesData.map((c) => [c.id, c.name])) as Record<
        string | number,
        string
      >,
    [companiesData],
  );

  // Summary chips — week = Mon 00:00 to Sun 23:59 in local time
  const { totalHoursThisWeek, billableHoursThisWeek, wipValueSZL } =
    useMemo(() => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const thisWeek = entries.filter((e) => {
        const d = new Date(e.entry_date);
        return d >= monday && d <= sunday;
      });

      const totalHoursThisWeek = thisWeek.reduce((s, e) => s + e.hours, 0);
      const billableThisWeek = thisWeek.filter((e) => e.billable);
      const billableHoursThisWeek = billableThisWeek.reduce(
        (s, e) => s + e.hours,
        0,
      );

      // WIP = all uninvoiced billable entries
      const wipValueSZL = entries
        .filter((e) => e.billable && e.invoice_id == null)
        .reduce((s, e) => s + e.hours * (e.hourly_rate_szl ?? 0), 0);

      return { totalHoursThisWeek, billableHoursThisWeek, wipValueSZL };
    }, [entries]);

  return (
    <div className="flex flex-col gap-6 mt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Time Billing</h1>
        <LogTimeDialog />
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Hours this week</p>
              <p className="text-xl font-bold">
                {totalHoursThisWeek.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                Billable hours this week
              </p>
              <p className="text-xl font-bold">
                {billableHoursThisWeek.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Wallet className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">WIP (uninvoiced)</p>
              <p className="text-xl font-bold">{formatSZL(wipValueSZL)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entries / Invoices tabs */}
      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">
            Time Entries ({entries.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices ({invoices.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="entries" className="mt-4">
          <TimeList entries={entries} companies={companies} />
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">
          <InvoiceList invoices={invoices} companies={companies} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

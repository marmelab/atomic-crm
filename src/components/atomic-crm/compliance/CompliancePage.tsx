import { CalendarDays, Kanban, List } from "lucide-react";
import { useDataProvider, useGetList, useTranslate } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { Company, ComplianceFiling } from "../types";
import { ComplianceCalendar } from "./ComplianceCalendar";
import { ComplianceKanban } from "./ComplianceKanban";
import { ComplianceList } from "./ComplianceList";

export const CompliancePage = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();

  const { data: filings = [], refetch } = useGetList<ComplianceFiling>(
    "compliance_filings",
    {
      pagination: { page: 1, perPage: 10000 },
      sort: { field: "due_date", order: "ASC" },
    },
  );

  const { data: companiesData = [] } = useGetList<Company>("companies", {
    pagination: { page: 1, perPage: 10000 },
    sort: { field: "name", order: "ASC" },
  });

  // Build a lookup map: company_id → company name
  const companies = useMemo(
    () =>
      Object.fromEntries(companiesData.map((c) => [c.id, c.name])) as Record<
        number,
        string
      >,
    [companiesData],
  );

  // Auto-flip UPCOMING filings whose due_date has passed to OVERDUE.
  // Runs once on page load (no cron needed in this phase).
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (flipped || filings.length === 0) return;
    setFlipped(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toFlip = filings.filter(
      (f) =>
        (f.status === "UPCOMING" || f.status === "IN_PROGRESS") &&
        !f.submitted_date &&
        new Date(f.due_date) < today,
    );

    if (toFlip.length === 0) return;

    Promise.all(
      toFlip.map((f) =>
        dataProvider.update<ComplianceFiling>("compliance_filings", {
          id: f.id,
          data: { status: "OVERDUE" },
          previousData: f,
        }),
      ),
    ).then(() => refetch());
  }, [filings, flipped, dataProvider, refetch]);

  return (
    <div className="flex flex-col gap-6 mt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {translate("resources.compliance_filings.name", {
            smart_count: 2,
            _: "Compliance Calendar",
          })}
        </h1>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" className="flex items-center gap-1.5">
            <List className="w-4 h-4" />
            {translate("crm.compliance.view_list", { _: "List" })}
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" />
            {translate("crm.compliance.view_calendar", { _: "Calendar" })}
          </TabsTrigger>
          <TabsTrigger value="kanban" className="flex items-center gap-1.5">
            <Kanban className="w-4 h-4" />
            {translate("crm.compliance.view_kanban", { _: "Kanban" })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <ComplianceList filings={filings} companies={companies} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <ComplianceCalendar filings={filings} companies={companies} />
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <ComplianceKanban filings={filings} companies={companies} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

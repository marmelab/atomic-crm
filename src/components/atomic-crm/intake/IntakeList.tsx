import { useMemo, useState } from "react";
import type { Identifier } from "ra-core";
import {
  RecordContextProvider,
  useGetList,
  useListContext,
  useTranslate,
} from "ra-core";
import { ChevronDown } from "lucide-react";
import { List } from "@/components/admin/list";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextField } from "@/components/admin/text-field";
import { TextInput } from "@/components/admin/text-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { IntakeLead } from "../types";
import { IntakeExpandedRow } from "./IntakeExpandedRow";
import { IntakeMobileList } from "./IntakeMobileList";
import { IntakePromoteButton } from "./IntakePromoteButton";
import { IntakeStatusBadge } from "./IntakeStatusBadge";

const ACTIVE_PIPELINE_STATUSES = [
  "uncontacted",
  "in-sequence",
  "engaged",
  "not-interested",
  "unresponsive",
] as const;

const ACTIVE_PIPELINE_FILTER = `(${ACTIVE_PIPELINE_STATUSES.join(",")})`;
const OUTREACH_STEPS_TOTAL = 7;

const intakeFilters = [
  <ReferenceInput
    key="trade_type_id"
    source="trade_type_id"
    reference="trade_types"
    perPage={100}
  >
    <SelectInput
      label="Trade Type"
      helperText={false}
      optionText="name"
      emptyText="All trade types"
    />
  </ReferenceInput>,
  <TextInput
    key="source"
    source="source@ilike"
    label="Source"
    helperText={false}
    placeholder="Filter by source"
  />,
];

export const IntakeList = () => {
  const translate = useTranslate();

  return (
    <List
      title={translate("resources.intake_leads.name", {
        smart_count: 2,
        _: "Intake Leads",
      })}
      actions={false}
      filters={intakeFilters}
      filterDefaultValues={{ "status@in": ACTIVE_PIPELINE_FILTER }}
      sort={{ field: "created_at", order: "DESC" }}
      perPage={25}
    >
      <IntakeListLayout />
    </List>
  );
};

const IntakeListLayout = () => {
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const { data, isPending, error, filterValues } = useListContext<IntakeLead>();
  const hasFilters = Boolean(
    filterValues &&
      Object.entries(filterValues).some(([key, value]) => {
        if (key === "status@in" && value === ACTIVE_PIPELINE_FILTER) {
          return false;
        }

        return value !== undefined && value !== null && value !== "";
      }),
  );

  if (isPending) {
    return null;
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="space-y-2 text-center">
          <h3 className="text-lg font-semibold">
            {translate("resources.intake_leads.error.title", {
              _: "Error loading intake leads",
            })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {translate("resources.intake_leads.error.description", {
              _: "Something went wrong. Please try again.",
            })}
          </p>
        </div>
      </Card>
    );
  }

  if (isMobile) {
    return <IntakeMobileList />;
  }

  return (
    <>
      <StatusTabBar />
      {!data?.length ? (
        <IntakeEmpty hasFilters={hasFilters} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <DesktopIntakeTable />
        </Card>
      )}
    </>
  );
};

const StatusTabBar = () => {
  const { displayedFilters, filterValues = {}, setFilters } =
    useListContext<IntakeLead>();

  // Single query for all active-pipeline leads, count by status client-side
  const { data: allLeads = [] } = useGetList<IntakeLead>("intake_leads", {
    filter: { "status@in": ACTIVE_PIPELINE_FILTER },
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "id", order: "ASC" },
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const lead of allLeads) {
      map[lead.status] = (map[lead.status] || 0) + 1;
    }
    return map;
  }, [allLeads]);

  const baseFilters = useMemo(() => {
    const next = { ...filterValues };
    delete next.status;
    delete next["status@in"];
    return next;
  }, [filterValues]);

  const tabs = [
    { id: "all", label: "All", count: allLeads.length },
    { id: "uncontacted", label: "Uncontacted", count: counts["uncontacted"] || 0 },
    { id: "in-sequence", label: "In Sequence", count: counts["in-sequence"] || 0 },
    { id: "engaged", label: "Engaged", count: counts["engaged"] || 0 },
    { id: "not-interested", label: "Not Interested", count: counts["not-interested"] || 0 },
    { id: "unresponsive", label: "Unresponsive", count: counts["unresponsive"] || 0 },
  ] as const;

  const activeTabId =
    typeof filterValues.status === "string" &&
    ACTIVE_PIPELINE_STATUSES.includes(
      filterValues.status as (typeof ACTIVE_PIPELINE_STATUSES)[number],
    )
      ? filterValues.status
      : "all";

  const handleTabClick = (tabId: string) => {
    const filter =
      tabId === "all"
        ? { ...baseFilters, "status@in": ACTIVE_PIPELINE_FILTER }
        : { ...baseFilters, status: tabId };
    setFilters(filter, displayedFilters);
  };

  return (
    <div className="mb-5 flex flex-wrap gap-3">
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
              isActive
                ? "border border-primary/35 bg-primary/12 text-primary"
                : "border border-border bg-white text-muted-foreground",
            )}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label} ({tab.count})
          </button>
        );
      })}
    </div>
  );
};

const IntakeEmpty = ({ hasFilters }: { hasFilters: boolean }) => {
  const translate = useTranslate();

  return (
    <Card className="p-6">
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold">
          {hasFilters
            ? translate("resources.intake_leads.empty.no_match_title", {
                _: "No intake leads match these filters",
              })
            : translate("resources.intake_leads.empty.title", {
                _: "No intake leads yet",
              })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? translate("resources.intake_leads.empty.no_match_description", {
                _: "Adjust your filters to widen the search.",
              })
            : translate("resources.intake_leads.empty.description", {
                _: "New leads will appear here as they arrive.",
              })}
        </p>
      </div>
    </Card>
  );
};

const DesktopIntakeTable = () => {
  const { data = [] } = useListContext<IntakeLead>();
  const translate = useTranslate();
  const [expandedIds, setExpandedIds] = useState<Identifier[]>([]);

  const toggleExpanded = (id: Identifier) => {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((expandedId) => expandedId !== id)
        : [...current, id],
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            {translate("resources.intake_leads.fields.business_name", {
              _: "Business Name",
            })}
          </TableHead>
          <TableHead>
            {translate("resources.intake_leads.fields.trade_type_id", {
              _: "Trade Type",
            })}
          </TableHead>
          <TableHead>
            {translate("resources.intake_leads.fields.city", { _: "City" })}
          </TableHead>
          <TableHead>
            {translate("resources.intake_leads.fields.source", { _: "Source" })}
          </TableHead>
          <TableHead>
            {translate("resources.intake_leads.fields.status", { _: "Status" })}
          </TableHead>
          <TableHead>Outreach Progress</TableHead>
          <TableHead className="text-right">
            {translate("ra.action.actions", { _: "Actions" })}
          </TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((record) => {
          const expanded = expandedIds.includes(record.id);

          return (
            <RecordContextProvider key={record.id} value={record}>
              <TableRow
                className="cursor-pointer hover:bg-primary/5"
                onClick={() => toggleExpanded(record.id)}
              >
                <TableCell className="font-medium">{record.business_name}</TableCell>
                <TableCell>
                  <ReferenceField
                    source="trade_type_id"
                    reference="trade_types"
                    link={false}
                    empty={<span className="text-muted-foreground">-</span>}
                  >
                    <Badge variant="secondary" className="rounded-full">
                      <TextField source="name" />
                    </Badge>
                  </ReferenceField>
                </TableCell>
                <TableCell>{record.city || "-"}</TableCell>
                <TableCell>{record.source || "-"}</TableCell>
                <TableCell>
                  <IntakeStatusBadge status={record.status} />
                </TableCell>
                <TableCell>
                  <OutreachProgress record={record} />
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex justify-end gap-2">
                    <IntakeActionButton
                      record={record}
                      onToggleExpanded={toggleExpanded}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <ChevronDown
                    className={cn(
                      "ml-auto size-4 text-muted-foreground transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </TableCell>
              </TableRow>
              {expanded ? (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={8} className="p-4">
                    <IntakeExpandedRow record={record} />
                  </TableCell>
                </TableRow>
              ) : null}
            </RecordContextProvider>
          );
        })}
      </TableBody>
    </Table>
  );
};

const OutreachProgress = ({ record }: { record: IntakeLead }) => {
  const nextDate = formatShortDate(record.next_outreach_date);
  const progressWidth = `${Math.max(
    0,
    Math.min(100, (record.outreach_sequence_step / OUTREACH_STEPS_TOTAL) * 100),
  )}%`;

  if (record.status === "uncontacted") {
    return <div className="text-sm text-muted-foreground">Ready for first touch</div>;
  }

  if (record.status === "in-sequence") {
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold">
          Touch {record.outreach_sequence_step}/{OUTREACH_STEPS_TOTAL}
        </div>
        <div className="h-2 w-40 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary"
            style={{ width: progressWidth }}
          />
        </div>
        <div className="text-xs text-muted-foreground">Next: {nextDate}</div>
      </div>
    );
  }

  if (record.status === "engaged") {
    return <div className="text-sm text-muted-foreground">Reply received</div>;
  }

  if (record.status === "not-interested") {
    return <div className="text-sm text-muted-foreground">Declined</div>;
  }

  if (record.status === "unresponsive") {
    return (
      <div className="text-sm text-muted-foreground">
        Touch {record.outreach_sequence_step}/{OUTREACH_STEPS_TOTAL} &middot; Next:{" "}
        {nextDate}
      </div>
    );
  }

  if (record.status === "qualified") {
    return <div className="text-sm text-muted-foreground">Promoted</div>;
  }

  if (record.status === "rejected") {
    return <div className="text-sm text-muted-foreground">Rejected</div>;
  }

  return <div className="text-sm text-muted-foreground">-</div>;
};

const IntakeActionButton = ({
  record,
  onToggleExpanded,
}: {
  record: IntakeLead;
  onToggleExpanded: (id: Identifier) => void;
}) => {
  const handleExpand = () => onToggleExpanded(record.id);

  if (record.status === "engaged") {
    return (
      <div className="[&_button]:border-green-500 [&_button]:bg-green-500 [&_button]:text-white">
        <IntakePromoteButton record={record} />
      </div>
    );
  }

  if (record.status === "qualified") {
    return (
      <Button type="button" size="sm" disabled>
        Promoted
      </Button>
    );
  }

  if (record.status === "rejected") {
    return (
      <Button type="button" size="sm" disabled>
        Rejected
      </Button>
    );
  }

  if (record.status === "not-interested") {
    return (
      <Button type="button" size="sm" variant="outline" onClick={handleExpand}>
        Review Notes
      </Button>
    );
  }

  if (record.status === "uncontacted") {
    return (
      <Button
        type="button"
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={handleExpand}
      >
        Send Outreach
      </Button>
    );
  }

  if (record.status === "in-sequence" || record.status === "unresponsive") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-primary/35 bg-primary/12 text-primary hover:bg-primary/20 hover:text-primary"
        onClick={handleExpand}
      >
        View Sequence
      </Button>
    );
  }

  return null;
};

const formatShortDate = (value: string | null) => {
  if (!value) {
    return "TBD";
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

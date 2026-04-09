import type { MouseEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import type { Identifier, InputProps } from "ra-core";
import {
  RecordContextProvider,
  useDataProvider,
  useListContext,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { ChevronDown } from "lucide-react";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { FilterButton } from "@/components/admin/filter-form";
import { DateField } from "@/components/admin/date-field";
import { List } from "@/components/admin/list";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextField } from "@/components/admin/text-field";
import { TextInput } from "@/components/admin/text-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

import { TopToolbar } from "../layout/TopToolbar";
import type { IntakeLead } from "../types";
import { IntakeExpandedRow } from "./IntakeExpandedRow";
import { IntakeMobileList } from "./IntakeMobileList";
import { IntakePromoteButton } from "./IntakePromoteButton";
import {
  INTAKE_REJECTION_REASONS,
  IntakeRejectButton,
} from "./IntakeRejectButton";
import { IntakeStatusBadge } from "./IntakeStatusBadge";

const statusChoices = [
  { id: "new", name: "New" },
  { id: "contacted", name: "Contacted" },
  { id: "responded", name: "Responded" },
  { id: "qualified", name: "Qualified" },
  { id: "rejected", name: "Rejected" },
];

const IntakeListActions = () => (
  <TopToolbar>
    <FilterButton />
  </TopToolbar>
);

const FilterFieldWrapper = ({ children }: InputProps & { children: ReactNode }) =>
  children;

const intakeFilters = [
  <FilterFieldWrapper key="status" source="status" label="Status">
    <SelectInput
      source="status"
      label={false}
      helperText={false}
      choices={statusChoices}
      emptyText="All statuses"
    />
  </FilterFieldWrapper>,
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
      actions={<IntakeListActions />}
      filters={intakeFilters}
      sort={{ field: "created_at", order: "DESC" }}
      perPage={25}
    >
      <IntakeListLayout />
    </List>
  );
};

const IntakeListLayout = () => {
  const isMobile = useIsMobile();
  const { data, isPending, filterValues } = useListContext<IntakeLead>();
  const hasFilters = Boolean(filterValues && Object.keys(filterValues).length > 0);

  if (isPending) {
    return null;
  }

  if (!data?.length) {
    return <IntakeEmpty hasFilters={hasFilters} />;
  }

  if (isMobile) {
    return <IntakeMobileList />;
  }

  return (
    <>
      <Card className="gap-0 overflow-hidden py-0">
        <DesktopIntakeTable />
      </Card>
      <BulkActionsToolbar>
        <IntakeBulkRejectButton />
      </BulkActionsToolbar>
    </>
  );
};

const IntakeEmpty = ({ hasFilters }: { hasFilters: boolean }) => (
  <Card className="p-6">
    <div className="space-y-2 text-center">
      <h3 className="text-lg font-semibold">
        {hasFilters ? "No intake leads match these filters" : "No intake leads yet"}
      </h3>
      <p className="text-sm text-muted-foreground">
        {hasFilters
          ? "Adjust your filters to widen the search."
          : "New leads will appear here as they arrive."}
      </p>
    </div>
  </Card>
);

const DesktopIntakeTable = () => {
  const { data = [], selectedIds = [], onSelect, onToggleItem } =
    useListContext<IntakeLead>();
  const [expandedIds, setExpandedIds] = useState<Identifier[]>([]);

  const selectableIds = useMemo(() => data.map((record) => record.id), [data]);
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.includes(id));

  const toggleExpanded = (id: Identifier) => {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((expandedId) => expandedId !== id)
        : [...current, id],
    );
  };

  const handleToggleAll = (checked: boolean) => {
    if (!onSelect) {
      return;
    }

    onSelect(
      checked
        ? Array.from(new Set([...selectedIds, ...selectableIds]))
        : selectedIds.filter((id) => !selectableIds.includes(id)),
    );
  };

  const handleToggleRowSelection =
    (id: Identifier) => (event: MouseEvent<HTMLTableCellElement>) => {
      event.stopPropagation();
      onToggleItem?.(id);
    };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => handleToggleAll(checked === true)}
            />
          </TableHead>
          <TableHead>Business Name</TableHead>
          <TableHead>Trade Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>City</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((record) => {
          const expanded = expandedIds.includes(record.id);

          return (
            <RecordContextProvider key={record.id} value={record}>
              <TableRow
                data-state={selectedIds.includes(record.id) ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => toggleExpanded(record.id)}
              >
                <TableCell onClick={handleToggleRowSelection(record.id)}>
                  <Checkbox checked={selectedIds.includes(record.id)} />
                </TableCell>
                <TableCell className="font-medium">{record.business_name}</TableCell>
                <TableCell>
                  <ReferenceField
                    source="trade_type_id"
                    reference="trade_types"
                    link={false}
                    empty={<span className="text-muted-foreground">-</span>}
                  >
                    <TextField source="name" />
                  </ReferenceField>
                </TableCell>
                <TableCell>
                  <IntakeStatusBadge status={record.status} />
                </TableCell>
                <TableCell>{record.city || "-"}</TableCell>
                <TableCell>{record.source || "-"}</TableCell>
                <TableCell className="text-muted-foreground">
                  <DateField source="created_at" />
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex justify-end gap-2">
                    <IntakePromoteButton record={record} />
                    <IntakeRejectButton record={record} />
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
                  <TableCell colSpan={9} className="p-4">
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

const IntakeBulkRejectButton = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { selectedIds = [], onUnselectItems } = useListContext<IntakeLead>();
  const [isPending, setIsPending] = useState(false);

  const handleReject = async (reason: string) => {
    if (!selectedIds.length) {
      return;
    }

    try {
      setIsPending(true);
      await dataProvider.updateMany("intake_leads", {
        ids: selectedIds,
        data: {
          status: "rejected",
          rejection_reason: reason,
        },
      });
      notify("Intake leads rejected", {
        type: "success",
        messageArgs: { _: "Selected intake leads were rejected" },
      });
      onUnselectItems?.();
      refresh();
    } catch (error) {
      notify("Failed to reject intake leads", {
        type: "error",
        messageArgs: {
          _: error instanceof Error
            ? error.message
            : "Failed to reject intake leads",
        },
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || !selectedIds.length}
          className="border-destructive/40 text-destructive hover:text-destructive"
        >
          Batch Reject
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {INTAKE_REJECTION_REASONS.map((reason) => (
          <DropdownMenuItem
            key={reason}
            className="cursor-pointer"
            onSelect={() => {
              void handleReject(reason);
            }}
          >
            {reason}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

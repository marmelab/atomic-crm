import {
  useDataProvider,
  useListContext,
  useNotify,
  useRecordContext,
  useTranslate,
  type RaRecord,
} from "ra-core";
import { useState } from "react";
import { DataTable } from "@/components/admin/data-table";
import { EditButton } from "@/components/admin/edit-button";
import { ListPagination } from "@/components/admin/list-pagination";
import { ReferenceArrayField } from "@/components/admin/reference-array-field";
import { ReferenceField } from "@/components/admin/reference-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

import { Avatar } from "../contacts/Avatar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Deal, Sale } from "../types";
import {
  findDealLabel,
  formatDealCategories,
  updateDealStage,
} from "./dealUtils";

/**
 * List (table) view of deals, exposing the very same filtered records as the
 * Kanban board through the shared List context: search, filters, sorting and
 * pagination are shared with the board, and Supabase stays the single source
 * of truth (no separate data fetching).
 */
export const DealTableView = () => {
  const { isPending } = useListContext<Deal>();
  const translate = useTranslate();

  if (isPending) return <DealTableSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <DataTable<Deal> bulkActionButtons={false} rowClick="show">
        <DataTable.Col
          source="name"
          label={translate("resources.deals.fields.name", { _: "Name" })}
        >
          <DealNameField />
        </DataTable.Col>
        <DataTable.Col
          source="company_id"
          label={translate("resources.deals.fields.company_id", {
            _: "Company",
          })}
          className="hidden md:table-cell"
        >
          <DealCompanyField />
        </DataTable.Col>
        <DataTable.Col
          source="contact_ids"
          label={translate("resources.deals.fields.contact_ids", {
            _: "Contacts",
          })}
          className="hidden lg:table-cell"
        >
          <ReferenceArrayField
            source="contact_ids"
            reference="contacts_summary"
          >
            <DealContactsField />
          </ReferenceArrayField>
        </DataTable.Col>
        <DataTable.Col
          source="amount"
          label={translate("resources.deals.fields.amount", { _: "Budget" })}
          cellClassName="text-right"
          headerClassName="text-right"
        >
          <DealAmountField />
        </DataTable.Col>
        <DataTable.Col
          source="stage"
          label={translate("resources.deals.fields.stage", { _: "Stage" })}
        >
          <DealStageSelector />
        </DataTable.Col>
        <DataTable.Col
          source="categories"
          label={translate("resources.deals.fields.categories", {
            _: "Categories",
          })}
          className="hidden xl:table-cell max-w-44"
        >
          <DealCategoriesField />
        </DataTable.Col>
        <DataTable.Col
          source="sales_id"
          label={translate("resources.deals.fields.sales_id", {
            _: "Account manager",
          })}
          className="hidden xl:table-cell"
          cellClassName="max-w-36"
        >
          <ReferenceField source="sales_id" reference="sales">
            <SaleNameField />
          </ReferenceField>
        </DataTable.Col>
        <DataTable.Col
          source="created_at"
          label={translate("resources.companies.fields.created_at", {
            _: "Created",
          })}
          className="hidden lg:table-cell whitespace-nowrap"
        >
          <DealCreatedAtField />
        </DataTable.Col>
        <DataTable.Col label={false} className="w-12" disableSort>
          <div onClick={(event) => event.stopPropagation()}>
            <EditButton />
          </div>
        </DataTable.Col>
      </DataTable>
      {/*
        Page size is kept at the existing Deals page value (100): the Kanban
        board reads the very same page of records, so a smaller page size
        would silently hide deals from the board when switching view.
      */}
      <ListPagination rowsPerPageOptions={[100]} />
    </div>
  );
};

/** Truncated deal name with the full name in the tooltip. */
const DealNameField = () => {
  const record = useRecordContext<Deal>();
  if (!record?.name) return null;
  return (
    <span title={record.name} className="block max-w-56 truncate font-medium">
      {record.name}
    </span>
  );
};

const DealCompanyField = () => {
  const record = useRecordContext<RaRecord>();
  if (!record?.name) return null;
  return (
    <span
      title={record.name}
      className="block max-w-40 truncate text-muted-foreground"
    >
      {record.name}
    </span>
  );
};

/**
 * Compact contact chips: avatar + short name on a single wrapped line
 * (at most 3 chips, then a "+N" overflow) instead of the stacked
 * name + position layout used on narrow summaries.
 */
const DealContactsField = () => {
  const contacts = useListContext<Contact>();
  if (!contacts.data) return null;

  const list = contacts.data;
  if (!list.length) {
    return <span className="text-muted-foreground">—</span>;
  }
  const maxContacts = 3;
  const visible = list.slice(0, maxContacts);
  const overflow = list.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((contact) => (
        <span
          key={String(contact.id)}
          title={[contact.first_name, contact.last_name]
            .filter(Boolean)
            .join(" ")}
          className="inline-flex max-w-32 items-center gap-1.5"
        >
          <Avatar record={contact} width={25} height={25} />
          <span className="truncate text-sm">
            {contact.first_name} {contact.last_name?.charAt(0)}.
          </span>
        </span>
      ))}
      {overflow > 0 && (
        <Badge variant="secondary" className="rounded-full px-2">
          +{overflow}
        </Badge>
      )}
    </div>
  );
};

const DealAmountField = () => {
  const record = useRecordContext<Deal>();
  const { currency } = useConfigurationContext();
  if (!record) return null;
  return (
    <span className="tabular-nums">
      {record.amount.toLocaleString("en-US", {
        notation: "compact",
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        minimumSignificantDigits: 3,
      })}
    </span>
  );
};

const STAGE_BADGE_CLASSES: Record<string, string | undefined> = {
  // New: neutral (plain outline).
  new: undefined,
  contacted:
    "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300",
  demo: "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300",
  interested:
    "border-cyan-300 text-cyan-700 dark:border-cyan-700 dark:text-cyan-300",
  // Not Interested (internal value "lost"): red.
  lost: "border-red-300 text-red-700 dark:border-red-700 dark:text-red-300",
  proposal:
    "border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300",
  "follow-up":
    "border-yellow-400 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300",
  won: "border-green-300 text-green-700 dark:border-green-700 dark:text-green-300",
};

/**
 * Inline stage selector. Labels come from the configured deal stages (so
 * customized pipelines are supported); colors are keyed by the internal stage
 * value and fall back to the neutral outline for unknown values.
 *
 * The change is persisted with the exact same logic as a Kanban drag-and-drop
 * (see updateDealStage in DealListContent): the deal is appended to the end of
 * the destination column and the other indexes are shifted accordingly, which
 * keeps both views in sync with a single write path.
 */
const DealStageSelector = () => {
  const { dealStages } = useConfigurationContext();
  const record = useRecordContext<Deal>();
  const dataProvider = useDataProvider();
  const { refetch } = useListContext<Deal>();
  const notify = useNotify();
  const translate = useTranslate();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!record) return null;

  const handleStageChange = async (stage: string | null) => {
    if (!stage || stage === record.stage) return;
    setIsUpdating(true);
    try {
      // undefined destination index: append at the end of the column,
      // like a drop below the last card of that stage
      await updateDealStage(record, { stage }, dataProvider);
      await refetch();
    } catch (error) {
      console.error(error);
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const items = dealStages.map((stage) => ({
    value: stage.value,
    label: stage.label,
  }));

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Select value={record.stage} onValueChange={handleStageChange}>
        <SelectTrigger
          size="sm"
          disabled={isUpdating}
          title={translate("resources.deals.fields.stage", { _: "Stage" })}
          className={cn(
            "w-auto min-w-28 gap-1 rounded-full px-2.5 text-xs font-medium",
            STAGE_BADGE_CLASSES[record.stage],
          )}
        >
          <SelectValue>
            {findDealLabel(dealStages, record.stage) ?? record.stage}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              <Badge
                variant="outline"
                className={cn(
                  "pointer-events-none",
                  STAGE_BADGE_CLASSES[item.value],
                )}
              >
                {item.label}
              </Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const DealCategoriesField = () => {
  const { dealCategories } = useConfigurationContext();
  const record = useRecordContext<Deal>();
  if (!record?.categories?.length) return null;
  return (
    <span
      title={formatDealCategories(dealCategories, record.categories)}
      className="block truncate text-sm text-muted-foreground"
    >
      {formatDealCategories(dealCategories, record.categories)}
    </span>
  );
};

const SaleNameField = () => {
  const record = useRecordContext<Sale>();
  if (!record) return null;
  return (
    <span
      title={`${record.first_name} ${record.last_name}`}
      className="block truncate text-sm text-muted-foreground whitespace-nowrap"
    >
      {record.first_name} {record.last_name}
    </span>
  );
};

/** Short date ("Oct 26"), including the year when it is not the current one. */
const DealCreatedAtField = () => {
  const record = useRecordContext<Deal>();
  if (!record?.created_at) return null;
  const date = new Date(record.created_at);
  const fullDate = date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (date.getFullYear() === new Date().getFullYear()) {
    const shortDate = date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    });
    return (
      <span
        title={fullDate}
        className="text-sm whitespace-nowrap text-muted-foreground"
      >
        {shortDate}
      </span>
    );
  }
  return (
    <span className="text-sm whitespace-nowrap text-muted-foreground">
      {fullDate}
    </span>
  );
};

const DealTableSkeleton = () => {
  const row: ComponentProps<typeof Skeleton> = { className: "h-6 w-full" };
  return (
    <div className="flex flex-col gap-2 rounded-md border p-4">
      <Table>
        <TableBody>
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: 6 }).map((_, cellIndex) => (
                <TableCell key={cellIndex}>
                  <Skeleton {...row} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

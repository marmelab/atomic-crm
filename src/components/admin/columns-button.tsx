import type { ComponentProps, ReactNode } from "react";
import { useState, useEffect, Children } from "react";
import { createPortal } from "react-dom";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as diacritic from "diacritic";
import type {
  RaRecord,
  Identifier,
  SortPayload,
  HintedString,
  ExtractRecordPaths,
} from "ra-core";
import {
  useDataTableStoreContext,
  useStore,
  useTranslate,
  useResourceContext,
  useDataTableColumnRankContext,
  useDataTableColumnFilterContext,
  useTranslateLabel,
  DataTableColumnRankContext,
  DataTableColumnFilterContext,
} from "ra-core";
import { Columns, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldToggle } from "@/components/admin/field-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Renders a button that lets users show / hide columns in a DataTable
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/columnsbutton/ ColumnsButton documentation}
 *
 * @example
 * import { List, DataTable, EditButton, CreateButton, ExportButton, ColumnsButton } from '@/components/admin';
 *
 * const PostsList = () => (
 *   <List
 *     actions={<>
 *       <ColumnsButton />
 *       <CreateButton />
 *       <ExportButton />
 *     </>}
 *   >
 *     <DataTable>
 *       <DataTable.Col source="title" />
 *       <DataTable.Col source="body" />
 *       <DataTable.Col source="updated_at" />
 *       <EditButton />
 *     </DataTable>
 *   </List>
 * );
 */
export const ColumnsButton = (props: ColumnsButtonProps) => {
  const { className, storeKey: _, ...rest } = props;
  const resource = useResourceContext(props);
  const storeKey = props.storeKey || `${resource}.datatable`;

  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const translate = useTranslate();

  const title = translate("ra.action.select_columns", { _: "Columns" });

  return (
    <span className={cn("inline-flex", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        {isMobile ? (
          // Base UI defaults tooltips to a 600ms open delay; the provider keeps
          // them instant without app-level setup.
          <TooltipProvider delay={0}>
            <Tooltip>
              <PopoverTrigger
                render={
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={title}
                        {...rest}
                      />
                    }
                  />
                }
              >
                <Columns className="size-4" />
              </PopoverTrigger>
              <TooltipContent>{title}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <PopoverTrigger
            render={
              <Button variant="outline" className="cursor-pointer" {...rest} />
            }
          >
            <Columns />
            {title}
          </PopoverTrigger>
        )}
        <PopoverContent align="start" className="w-72 min-w-[200px] p-0">
          <div id={`${storeKey}-columnsSelector`} className="p-2" />
        </PopoverContent>
      </Popover>
    </span>
  );
};

export interface ColumnsButtonProps extends ComponentProps<typeof Button> {
  resource?: string;
  storeKey?: string;
}

/**
 * Render DataTable.Col elements in the ColumnsButton selector using a React Portal.
 *
 * @see ColumnsButton
 */
export const ColumnsSelector = ({ children }: ColumnsSelectorProps) => {
  const translate = useTranslate();
  const { storeKey, defaultHiddenColumns } = useDataTableStoreContext();
  const [columnRanks, setColumnRanks] = useStore<number[] | undefined>(
    `${storeKey}_columnRanks`,
  );
  const [_hiddenColumns, setHiddenColumns] = useStore<string[]>(
    storeKey,
    defaultHiddenColumns,
  );
  const elementId = `${storeKey}-columnsSelector`;

  const [container, setContainer] = useState<HTMLElement | null>(null);

  // Track the portal container across popover mount/unmount cycles.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const resolveContainer = () => {
      const target = document.getElementById(elementId);
      setContainer((current) => {
        if (target === current) return current;
        if (target) return target;
        if (current && !document.body.contains(current)) return null;
        return current;
      });
    };

    resolveContainer();

    const observer = new MutationObserver(resolveContainer);

    // The popover renders its content in a portal appended to <body>, so
    // watching body's direct children is enough to catch it opening and
    // closing. Watching the whole subtree instead would run this on every DOM
    // mutation of the list for as long as the view is mounted.
    observer.observe(document.body, { childList: true });

    return () => {
      observer.disconnect();
    };
  }, [elementId]);

  const [columnFilter, setColumnFilter] = useState<string>("");

  if (!container) return null;

  const childrenArray = Children.toArray(children);
  const paddedColumnRanks = padRanks(columnRanks ?? [], childrenArray.length);
  const shouldDisplaySearchInput = childrenArray.length > 5;

  return createPortal(
    <div>
      {shouldDisplaySearchInput && (
        <div className="relative p-1">
          <Input
            value={columnFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setColumnFilter(e.target.value);
            }}
            placeholder={translate("ra.action.search_columns", {
              _: "Search columns",
            })}
            className="pr-8"
          />
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          {columnFilter && (
            <button
              onClick={() => setColumnFilter("")}
              className="absolute right-8 top-2 h-4 w-4 text-muted-foreground"
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>
      )}
      <ul className="max-h-[50vh] p-1 overflow-auto">
        {paddedColumnRanks.map((position, index) => (
          <DataTableColumnRankContext.Provider value={position} key={index}>
            <DataTableColumnFilterContext.Provider
              value={columnFilter}
              key={index}
            >
              {childrenArray[position]}
            </DataTableColumnFilterContext.Provider>
          </DataTableColumnRankContext.Provider>
        ))}
      </ul>
      <div className="text-center py-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setColumnRanks(undefined);
            setHiddenColumns(defaultHiddenColumns);
          }}
        >
          Reset
        </Button>
      </div>
    </div>,
    container,
  );
};

interface ColumnsSelectorProps {
  children?: React.ReactNode;
}

export const ColumnsSelectorItem = <
  RecordType extends RaRecord<Identifier> = RaRecord<Identifier>,
>({
  source,
  label,
}: ColumnsSelectorItemProps<RecordType>) => {
  const resource = useResourceContext();
  const { storeKey, defaultHiddenColumns } = useDataTableStoreContext();
  const [hiddenColumns, setHiddenColumns] = useStore<string[]>(
    storeKey,
    defaultHiddenColumns,
  );
  const columnRank = useDataTableColumnRankContext();
  const [columnRanks, setColumnRanks] = useStore<number[]>(
    `${storeKey}_columnRanks`,
  );
  const columnFilter = useDataTableColumnFilterContext();
  const translateLabel = useTranslateLabel();
  if (!source && !label) return null;
  const fieldLabel = translateLabel({
    label: typeof label === "string" ? label : undefined,
    resource,
    source,
  }) as string;
  const isColumnHidden = hiddenColumns.includes(source!);
  const isColumnFiltered = fieldLabelMatchesFilter(fieldLabel, columnFilter);

  const handleMove = (
    index1: number | string,
    index2: number | string | null,
  ) => {
    const colRanks = !columnRanks
      ? padRanks([], Math.max(Number(index1), Number(index2 || 0)) + 1)
      : Math.max(Number(index1), Number(index2 || 0)) > columnRanks.length - 1
        ? padRanks(
            columnRanks,
            Math.max(Number(index1), Number(index2 || 0)) + 1,
          )
        : columnRanks;
    const index1Pos = colRanks.findIndex((index) => index == Number(index1));
    const index2Pos = colRanks.findIndex((index) => index == Number(index2));
    if (index1Pos === -1 || index2Pos === -1) {
      return;
    }
    let newColumnRanks;
    if (index1Pos > index2Pos) {
      newColumnRanks = [
        ...colRanks.slice(0, index2Pos),
        colRanks[index1Pos],
        ...colRanks.slice(index2Pos, index1Pos),
        ...colRanks.slice(index1Pos + 1),
      ];
    } else {
      newColumnRanks = [
        ...colRanks.slice(0, index1Pos),
        ...colRanks.slice(index1Pos + 1, index2Pos + 1),
        colRanks[index1Pos],
        ...colRanks.slice(index2Pos + 1),
      ];
    }
    setColumnRanks(newColumnRanks);
  };

  return isColumnFiltered ? (
    <FieldToggle
      key={columnRank}
      source={source!}
      label={fieldLabel}
      index={String(columnRank)}
      selected={!isColumnHidden}
      onToggle={() =>
        isColumnHidden
          ? setHiddenColumns(
              hiddenColumns.filter((column) => column !== source!),
            )
          : setHiddenColumns([...hiddenColumns, source!])
      }
      onMove={handleMove}
    />
  ) : null;
};

// this is the same interface as DataTableColumnProps
// but we copied it here to avoid circular dependencies with data-table
export interface ColumnsSelectorItemProps<
  RecordType extends RaRecord<Identifier> = RaRecord<Identifier>,
> {
  className?: string;
  cellClassName?: string;
  headerClassName?: string;
  conditionalClassName?: (record: RecordType) => string | false | undefined;
  children?: ReactNode;
  render?: (record: RecordType) => React.ReactNode;
  field?: React.ElementType;
  source?: NoInfer<HintedString<ExtractRecordPaths<RecordType>>>;
  label?: React.ReactNode;
  disableSort?: boolean;
  sortByOrder?: SortPayload["order"];
}
// Function to help with column ranking
const padRanks = (ranks: number[], length: number) =>
  ranks.concat(
    Array.from({ length: length - ranks.length }, (_, i) => ranks.length + i),
  );

const fieldLabelMatchesFilter = (fieldLabel: string, columnFilter?: string) =>
  columnFilter
    ? diacritic
        .clean(fieldLabel)
        .toLowerCase()
        .includes(diacritic.clean(columnFilter).toLowerCase())
    : true;

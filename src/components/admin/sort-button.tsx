import * as React from "react";
import { memo } from "react";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import {
  shallowEqual,
  useListSortContext,
  useResourceContext,
  useTranslate,
  useTranslateLabel,
} from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * A button that opens a dropdown menu to change list sorting.
 *
 * Displays current sort field and order, and toggles between ASC and DESC when clicking the same field again.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/sortbutton/ SortButton documentation}
 *
 * @example
 * import { SortButton } from '@/components/admin';
 *
 * const PostList = () => (
 *   <List render={({ data }) => (
 *     <div>
 *       <SortButton fields={["title", "published_at"]} />
 *       <ul>
 *         {data.map(post => (
 *           <li key={post.id}>{post.title}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   )}>
 * );
 */
const SortButtonComponent = (props: SortButtonProps) => {
  const {
    fields,
    options,
    label = "ra.sort.sort_by",
    icon = defaultIcon,
    resource: _resource,
    ...rest
  } = props;
  const resource = useResourceContext(props);
  const { sort, setSort } = useListSortContext();
  const translate = useTranslate();
  const translateLabel = useTranslateLabel();
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);

  // An explicit ordering sets exactly what it says, with no toggling —
  // picking "Date added — oldest first" must give ascending even when the
  // list is already sorted by that field.
  const handleChooseOption = (option: SortOption) => {
    setSort({ field: option.field, order: option.order });
    setOpen(false);
  };

  const handleChangeSort = (field: string) => {
    setSort({
      field,
      order: field === sort.field ? inverseOrder(sort.order) : "ASC",
    });
    setOpen(false);
  };

  const fieldLabel = translateLabel({
    resource,
    source: sort.field,
  });
  const translationOptions = {
    field: fieldLabel,
    field_lower_first:
      typeof fieldLabel === "string"
        ? fieldLabel.charAt(0).toLowerCase() + fieldLabel.slice(1)
        : undefined,
    order: translate(`ra.sort.${sort.order}`),
  };
  const buttonLabel = translate(`resources.${resource}.action.sort_by`, {
    ...translationOptions,
    _: translate(label, { ...translationOptions, _: label }),
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {isMobile ? (
        <TooltipProvider>
          <Tooltip>
            <DropdownMenuTrigger asChild>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={buttonLabel}
                  {...rest}
                >
                  {icon}
                </Button>
              </TooltipTrigger>
            </DropdownMenuTrigger>
            <TooltipContent>
              <p>{buttonLabel}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9" {...rest}>
            {icon}
            <span className="ml-2">{buttonLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="start">
        {options
          ? options.map((option) => (
              <DropdownMenuItem
                key={`${option.field}-${option.order}`}
                onClick={() => handleChooseOption(option)}
              >
                {option.label ??
                  `${translateLabel({ resource, source: option.field })} ${translate(
                    `ra.sort.${option.order}`,
                  )}`}
              </DropdownMenuItem>
            ))
          : (fields ?? []).map((field) => (
              <DropdownMenuItem
                key={field}
                onClick={() => handleChangeSort(field)}
              >
                {translateLabel({
                  resource,
                  source: field,
                })}{" "}
                {translate(
                  `ra.sort.${
                    sort.field === field ? inverseOrder(sort.order) : "ASC"
                  }`,
                )}
              </DropdownMenuItem>
            ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const defaultIcon = <ArrowUpDown className="h-4 w-4" />;

const inverseOrder = (sort: string) => (sort === "ASC" ? "DESC" : "ASC");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arePropsEqual = (prevProps: any, nextProps: any) =>
  shallowEqual(prevProps.fields, nextProps.fields) &&
  shallowEqual(prevProps.options, nextProps.options);

// An explicit ordering, shown as its own menu entry. The `fields` API
// below offers one entry per field and toggles direction on re-click, which
// cannot express "oldest first" for a field you are not already sorting by
// (a fresh field always starts ASC). For a date column that is exactly the
// ordering somebody wants, so a list may instead name every ordering it
// supports and label it in business language.
export type SortOption = {
  field: string;
  order: "ASC" | "DESC";
  // Business-language label, e.g. "Date added — newest first". Falls back
  // to the field label plus direction when omitted.
  label?: string;
};

export interface SortButtonProps extends ButtonProps {
  // Exactly one of these. `options` wins when both are given.
  fields?: string[];
  options?: SortOption[];
  icon?: React.ReactNode;
  label?: string;
  resource?: string;
}

export const SortButton = memo(SortButtonComponent, arePropsEqual);

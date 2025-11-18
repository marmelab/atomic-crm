import * as React from "react";
import type { HtmlHTMLAttributes, ReactNode } from "react";
import { useCallback, useEffect, useState, isValidElement } from "react";
import get from "lodash/get";
import isEqual from "lodash/isEqual";
import queryString from "query-string";
import {
  FieldTitle,
  FilterLiveForm,
  useFilterContext,
  useListContext,
  useResourceContext,
  useTranslate,
} from "ra-core";
import { useNavigate } from "react-router";
import {
  Bookmark,
  BookmarkMinus,
  BookmarkPlus,
  Check,
  Filter,
  MinusCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractValidSavedQueries,
  SavedQuery,
  useSavedQueries,
} from "@/hooks/saved-queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AddSavedQueryDialog,
  RemoveSavedQueryDialog,
} from "@/components/admin/saved-queries";

export const FilterForm = (inProps: FilterFormProps) => {
  const { filters: filtersProps, ...rest } = inProps;
  const filters = useFilterContext() || filtersProps;

  return (
    <FilterLiveForm formComponent={StyledForm} {...sanitizeRestProps(rest)}>
      <FilterFormBase filters={filters} />
    </FilterLiveForm>
  );
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FilterFormProps extends FilterFormBaseProps {}

/**
 * @deprecated Use FilterFormBase from `ra-core` once available.
 */
export const FilterFormBase = (props: FilterFormBaseProps) => {
  const { filters } = props;
  const resource = useResourceContext(props);
  const { displayedFilters = {}, filterValues, hideFilter } = useListContext();

  useEffect(() => {
    if (!filters) return;
    filters
      .filter((filterElement) => isValidElement(filterElement))
      .forEach((filter) => {
        if (
          (filter.props as any).alwaysOn &&
          (filter.props as any).defaultValue
        ) {
          throw new Error(
            "Cannot use alwaysOn and defaultValue on a filter input. Please set the filterDefaultValues props on the <List> element instead.",
          );
        }
      });
  }, [filters]);

  const getShownFilters = () => {
    if (!filters) return [];
    const values = filterValues;
    return filters
      .filter((filterElement) => isValidElement(filterElement))
      .filter((filterElement) => {
        const filterValue = get(values, (filterElement.props as any).source);
        return (
          (filterElement.props as any).alwaysOn ||
          displayedFilters[(filterElement.props as any).source] ||
          !isEmptyValue(filterValue)
        );
      });
  };

  const handleHide = useCallback(
    (event: React.MouseEvent<HTMLElement>) =>
      hideFilter(event.currentTarget.dataset.key!),
    [hideFilter],
  );

  return (
    <>
      {getShownFilters().map((filterElement) => (
        <FilterFormInput
          key={filterElement.key || (filterElement.props as any).source}
          filterElement={filterElement}
          handleHide={handleHide}
          resource={resource}
        />
      ))}
    </>
  );
};

const sanitizeRestProps = ({
  hasCreate: _hasCreate,
  resource: _resource,
  ...props
}: Partial<FilterFormBaseProps> & { hasCreate?: boolean }) => props;

export type FilterFormBaseProps = Omit<
  HtmlHTMLAttributes<HTMLFormElement>,
  "children"
> & {
  className?: string;
  resource?: string;
  filters?: ReactNode[];
};

const StyledForm = (props: React.FormHTMLAttributes<HTMLFormElement>) => {
  return (
    <form
      {...props}
      className={cn(
        "flex flex-row justify-start items-end gap-x-2 gap-y-3 pointer-events-none flex-wrap",
        "[&_.form-helper-text]:hidden",
        props.className,
      )}
    />
  );
};

const isEmptyValue = (filterValue: any): boolean => {
  if (filterValue === "" || filterValue == null) return true;

  // If one of the value leaf is not empty
  // the value is considered not empty
  if (typeof filterValue === "object") {
    return Object.keys(filterValue).every((key) =>
      isEmptyValue(filterValue[key]),
    );
  }

  return false;
};

export const FilterFormInput = (inProps: FilterFormInputProps) => {
  const { filterElement, handleHide, className } = inProps;
  const resource = useResourceContext(inProps);
  const translate = useTranslate();

  return (
    <div
      data-source={filterElement.props.source}
      className={cn(
        "filter-field flex flex-row pointer-events-auto gap-2 relative",
        className,
      )}
    >
      {React.cloneElement(filterElement, {
        resource,
        record: emptyRecord,
        size: filterElement.props.size ?? "small",
        helperText: false,
        // ignore defaultValue in Field because it was already set in Form (via mergedInitialValuesWithDefaultValues)
        defaultValue: undefined,
      })}
      {!filterElement.props.alwaysOn && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hide-filter h-9 w-9 cursor-pointer mt-auto"
          onClick={handleHide}
          data-key={filterElement.props.source}
          title={translate("ra.action.remove_filter")}
        >
          <MinusCircle className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export interface FilterFormInputProps {
  filterElement: React.ReactElement<any>;
  handleHide: (event: React.MouseEvent<HTMLElement>) => void;
  className?: string;
  resource?: string;
}

const emptyRecord = {};

export const FilterButton = (props: FilterButtonProps) => {
  const {
    filters: filtersProp,
    className,
    disableSaveQuery,
    size,
    variant = "outline",
    ...rest
  } = props;
  const filters = useFilterContext() || filtersProp;
  const resource = useResourceContext(props);
  const translate = useTranslate();
  if (!resource && !disableSaveQuery) {
    throw new Error(
      "<FilterButton> must be called inside a ResourceContextProvider, or must provide a resource prop",
    );
  }
  const [savedQueries] = useSavedQueries(resource || "");
  const navigate = useNavigate();
  const {
    displayedFilters = {},
    filterValues,
    perPage,
    setFilters,
    showFilter,
    hideFilter,
    sort,
  } = useListContext();
  const hasFilterValues = !isEqual(filterValues, {});
  const validSavedQueries = extractValidSavedQueries(savedQueries);
  const hasSavedCurrentQuery = validSavedQueries.some((savedQuery) =>
    isEqual(savedQuery.value, {
      filter: filterValues,
      sort,
      perPage,
      displayedFilters,
    }),
  );
  const [open, setOpen] = useState(false);

  if (filters === undefined) {
    throw new Error(
      "The <FilterButton> component requires the <List filters> prop to be set",
    );
  }

  const allTogglableFilters = filters.filter(
    (filterElement) =>
      isValidElement(filterElement) && !(filterElement.props as any).alwaysOn,
  );

  const handleShow = useCallback(
    ({ source, defaultValue }: { source: string; defaultValue: any }) => {
      showFilter(source, defaultValue === "" ? undefined : defaultValue);
      // We have to fallback to imperative code because the new FilterFormInput
      // has no way of knowing it has just been displayed (and thus that it should focus its input)
      setTimeout(() => {
        const inputElement = document.querySelector(
          `input[name='${source}']`,
        ) as HTMLInputElement;
        if (inputElement) {
          inputElement.focus();
        }
      }, 50);
      setOpen(false);
    },
    [showFilter, setOpen],
  );

  const handleRemove = useCallback(
    ({ source }: { source: string }) => {
      hideFilter(source);
      setOpen(false);
    },
    [hideFilter, setOpen],
  );

  // add query dialog state
  const [addSavedQueryDialogOpen, setAddSavedQueryDialogOpen] = useState(false);
  const hideAddSavedQueryDialog = (): void => {
    setAddSavedQueryDialogOpen(false);
  };
  const showAddSavedQueryDialog = (): void => {
    setOpen(false);
    setAddSavedQueryDialogOpen(true);
  };

  // remove query dialog state
  const [removeSavedQueryDialogOpen, setRemoveSavedQueryDialogOpen] =
    useState(false);
  const hideRemoveSavedQueryDialog = (): void => {
    setRemoveSavedQueryDialogOpen(false);
  };
  const showRemoveSavedQueryDialog = (): void => {
    setOpen(false);
    setRemoveSavedQueryDialogOpen(true);
  };

  if (
    allTogglableFilters.length === 0 &&
    validSavedQueries.length === 0 &&
    !hasFilterValues
  ) {
    return null;
  }
  return (
    <div className={cn("inline-block", className)} {...rest}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            className="add-filter"
            variant={variant}
            size={size}
            aria-haspopup="true"
          >
            <Filter className="h-4 w-4" />
            {translate("ra.action.add_filter")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {allTogglableFilters
            .filter((filterElement) => isValidElement(filterElement))
            .map((filterElement, index: number) => (
              <FilterButtonMenuItem
                key={(filterElement.props as any).source}
                filter={filterElement}
                displayed={
                  !!displayedFilters[(filterElement.props as any).source]
                }
                resource={resource}
                onShow={handleShow}
                onHide={handleRemove}
                autoFocus={index === 0}
              />
            ))}
          {(hasFilterValues || validSavedQueries.length > 0) && (
            <DropdownMenuSeparator />
          )}
          {validSavedQueries.map((savedQuery: SavedQuery, index: number) =>
            isEqual(savedQuery.value, {
              filter: filterValues,
              sort,
              perPage,
              displayedFilters,
            }) ? (
              <DropdownMenuItem
                onClick={showRemoveSavedQueryDialog}
                key={index}
              >
                <BookmarkMinus className="h-4 w-4 mr-2" />
                {translate("ra.saved_queries.remove_label_with_name", {
                  _: 'Remove query "%{name}"',
                  name: savedQuery.label,
                })}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={(): void => {
                  navigate({
                    search: queryString.stringify({
                      filter: JSON.stringify(savedQuery.value.filter),
                      sort: savedQuery.value.sort?.field,
                      order: savedQuery.value.sort?.order,
                      page: 1,
                      perPage: savedQuery.value.perPage,
                      displayedFilters: JSON.stringify(
                        savedQuery.value.displayedFilters,
                      ),
                    }),
                  });
                  setOpen(false);
                }}
                key={index}
              >
                <Bookmark className="h-4 w-4 mr-2" />
                {savedQuery.label}
              </DropdownMenuItem>
            ),
          )}
          {hasFilterValues && !hasSavedCurrentQuery && !disableSaveQuery && (
            <DropdownMenuItem onClick={showAddSavedQueryDialog}>
              <BookmarkPlus className="h-4 w-4 mr-2" />
              {translate("ra.saved_queries.new_label", {
                _: "Save current query...",
              })}
            </DropdownMenuItem>
          )}
          {hasFilterValues && (
            <DropdownMenuItem
              onClick={() => {
                setFilters({}, {});
                setOpen(false);
              }}
            >
              <X className="h-4 w-4 mr-2" />
              {translate("ra.action.remove_all_filters", {
                _: "Remove all filters",
              })}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {!disableSaveQuery && (
        <>
          <AddSavedQueryDialog
            open={addSavedQueryDialogOpen}
            onClose={hideAddSavedQueryDialog}
          />
          <RemoveSavedQueryDialog
            open={removeSavedQueryDialogOpen}
            onClose={hideRemoveSavedQueryDialog}
          />
        </>
      )}
    </div>
  );
};

export interface FilterButtonProps extends HtmlHTMLAttributes<HTMLDivElement> {
  className?: string;
  disableSaveQuery?: boolean;
  filters?: ReactNode[];
  resource?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const FilterButtonMenuItem = React.forwardRef<
  HTMLDivElement,
  FilterButtonMenuItemProps
>((props, ref) => {
  const { filter, onShow, onHide, displayed } = props;
  const resource = useResourceContext(props);
  const handleShow = useCallback(() => {
    onShow({
      source: filter.props.source,
      defaultValue: filter.props.defaultValue,
    });
  }, [filter.props.defaultValue, filter.props.source, onShow]);
  const handleHide = useCallback(() => {
    onHide({
      source: filter.props.source,
    });
  }, [filter.props.source, onHide]);

  return (
    <div
      className={cn(
        "new-filter-item flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm",
        filter.props.disabled && "opacity-50 cursor-not-allowed",
      )}
      data-key={filter.props.source}
      data-default-value={filter.props.defaultValue}
      onClick={
        filter.props.disabled ? undefined : displayed ? handleHide : handleShow
      }
      ref={ref}
      role="menuitemcheckbox"
      aria-checked={displayed}
    >
      <div className="flex items-center justify-center w-4 h-4 mr-2">
        {displayed && <Check className="h-3 w-3" />}
      </div>
      <div>
        <FieldTitle
          label={filter.props.label}
          source={filter.props.source}
          resource={resource}
        />
      </div>
    </div>
  );
});

export interface FilterButtonMenuItemProps {
  filter: React.ReactElement<any>;
  displayed: boolean;

  onShow: (params: { source: string; defaultValue: any }) => void;
  onHide: (params: { source: string }) => void;
  resource?: string;
  autoFocus?: boolean;
}

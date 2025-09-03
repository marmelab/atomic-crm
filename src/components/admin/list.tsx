import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/admin/breadcrumb";
import {
  ListBase,
  ListBaseProps,
  type ListControllerResult,
  RaRecord,
  Translate,
  useGetResourceLabel,
  useHasDashboard,
  useResourceContext,
  useResourceDefinition,
  useTranslate,
} from "ra-core";
import { ReactElement, ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { FilterContext, FilterElementProps } from "@/hooks/filter-context";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { ListPagination } from "@/components/admin/list-pagination";
import { FilterForm } from "@/components/admin/filter-form";

export const List = <RecordType extends RaRecord = RaRecord>(
  props: ListProps<RecordType>,
) => {
  const {
    debounce,
    disableAuthentication,
    disableSyncWithLocation,
    exporter,
    filter,
    filterDefaultValues,
    loading,
    perPage,
    queryOptions,
    resource,
    sort,
    storeKey,
    ...rest
  } = props;

  return (
    <ListBase<RecordType>
      debounce={debounce}
      disableAuthentication={disableAuthentication}
      disableSyncWithLocation={disableSyncWithLocation}
      exporter={exporter}
      filter={filter}
      filterDefaultValues={filterDefaultValues}
      loading={loading}
      perPage={perPage}
      queryOptions={queryOptions}
      resource={resource}
      sort={sort}
      storeKey={storeKey}
    >
      <ListView<RecordType> {...rest} />
    </ListBase>
  );
};

export interface ListProps<RecordType extends RaRecord = RaRecord>
  extends ListBaseProps<RecordType>,
    ListViewProps<RecordType> {}

export const ListView = <RecordType extends RaRecord = RaRecord>(
  props: ListViewProps<RecordType>,
) => {
  const {
    filters,
    pagination = defaultPagination,
    title,
    children,
    actions,
  } = props;
  const translate = useTranslate();
  const resource = useResourceContext();
  if (!resource) {
    throw new Error(
      "The ListView component must be used within a ResourceContextProvider",
    );
  }
  const getResourceLabel = useGetResourceLabel();
  const resourceLabel = getResourceLabel(resource, 2);
  const finalTitle =
    title !== undefined
      ? title
      : translate("ra.page.list", {
          name: resourceLabel,
        });
  const { hasCreate } = useResourceDefinition({ resource });
  const hasDashboard = useHasDashboard();

  return (
    <>
      <Breadcrumb>
        {hasDashboard && (
          <BreadcrumbItem>
            <Link to="/">
              <Translate i18nKey="ra.page.dashboard">Home</Translate>
            </Link>
          </BreadcrumbItem>
        )}
        <BreadcrumbPage>{resourceLabel}</BreadcrumbPage>
      </Breadcrumb>

      <FilterContext.Provider value={filters}>
        <div className="flex justify-between items-start flex-wrap gap-2 my-2">
          <h2 className="text-2xl font-bold tracking-tight mb-2">
            {finalTitle}
          </h2>
          {actions ?? (
            <div className="flex items-center gap-2">
              {hasCreate ? <CreateButton /> : null}
              {<ExportButton />}
            </div>
          )}
        </div>
        <FilterForm />

        <div className={cn("my-2", props.className)}>{children}</div>
        {pagination}
      </FilterContext.Provider>
    </>
  );
};

const defaultPagination = <ListPagination />;

export interface ListViewProps<RecordType extends RaRecord = RaRecord> {
  children?: ReactNode;
  render?: (props: ListControllerResult<RecordType, Error>) => ReactNode;
  actions?: ReactElement | false;
  filters?: ReactElement<FilterElementProps>[];
  pagination?: ReactNode;
  title?: ReactNode | string | false;
  className?: string;
}

export type FiltersType =
  | ReactElement<FilterElementProps>
  | ReactElement<FilterElementProps>[];

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/admin/breadcrumb";
import type { ShowBaseProps } from "ra-core";
import {
  ShowBase,
  Translate,
  useCreatePath,
  useHasDashboard,
  useShowContext,
  useGetRecordRepresentation,
  useGetResourceLabel,
  useResourceContext,
  useResourceDefinition,
} from "ra-core";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { EditButton } from "@/components/admin/edit-button";

export interface ShowProps
  extends ShowViewProps, Omit<ShowBaseProps, "children"> {}

/**
 * A complete show page with breadcrumb, title, and default actions.
 *
 * Combines data fetching and UI layout for displaying record details. Inside, use
 * RecordField to display individual fields with labels.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/show/ Show documentation}
 *
 * @example
 * import { RecordField, NumberField, ReferenceField, Show } from "@/components/admin";
 *
 * export const ProductShow = () => (
 *   <Show>
 *     <div className="flex flex-col gap-4">
 *       <RecordField source="reference" />
 *       <RecordField source="category_id">
 *         <ReferenceField source="category_id" reference="categories" />
 *       </RecordField>
 *       <RecordField
 *         source="price"
 *         render={(record) => Intl.NumberFormat().format(record.price)}
 *       />
 *       <RecordField source="size" field={NumberField} />
 *     </div>
 *   </Show>
 * );
 */
export const Show = ({
  actions,
  children,
  className,
  disableAuthentication,
  disableBreadcrumb,
  id,
  loading,
  queryOptions,
  render,
  resource,
  title,
}: ShowProps) => (
  <ShowBase
    id={id}
    resource={resource}
    queryOptions={queryOptions}
    disableAuthentication={disableAuthentication}
    render={render}
    loading={loading}
  >
    <ShowView
      title={title}
      actions={actions}
      className={className}
      disableBreadcrumb={disableBreadcrumb}
    >
      {children}
    </ShowView>
  </ShowBase>
);

export interface ShowViewProps {
  actions?: ReactNode;
  disableBreadcrumb?: boolean;
  children: ReactNode;
  className?: string;
  emptyWhileLoading?: boolean;
  title?: ReactNode | string | false;
}

/**
 * The view component for Show pages with layout and UI.
 *
 * Renders breadcrumb, title, and default actions for show pages. Use Show instead unless you need
 * custom data fetching logic with ShowBase.
 *
 * @example
 * import { ShowBase, ShowView, SimpleShowLayout } from '@/components/admin';
 *
 * export const PostShow = () => (
 *     <ShowBase>
 *         <ShowView>
 *             <SimpleShowLayout>...</SimpleShowLayout>
 *         </ShowView>
 *     </ShowBase>
 * );
 */
export const ShowView = ({
  actions,
  children,
  className,
  disableBreadcrumb,
  emptyWhileLoading,
  title,
}: ShowViewProps) => {
  const context = useShowContext();

  const resource = useResourceContext();
  if (!resource) {
    throw new Error(
      "The ShowView component must be used within a ResourceContextProvider",
    );
  }
  const getResourceLabel = useGetResourceLabel();
  const listLabel = getResourceLabel(resource, 2);
  const createPath = useCreatePath();
  const listLink = createPath({
    resource,
    type: "list",
  });

  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const recordRepresentation = getRecordRepresentation(context.record);

  const { hasEdit } = useResourceDefinition({ resource });
  const hasDashboard = useHasDashboard();

  if (context.isLoading || !context.record) {
    return null;
  }
  if (!context.record && emptyWhileLoading) {
    return null;
  }

  return (
    <>
      {!disableBreadcrumb && (
        <Breadcrumb>
          {hasDashboard && (
            <BreadcrumbItem>
              <Link to="/">
                <Translate i18nKey="ra.page.dashboard">Home</Translate>
              </Link>
            </BreadcrumbItem>
          )}
          <BreadcrumbItem>
            <Link to={listLink}>{listLabel}</Link>
          </BreadcrumbItem>
          <BreadcrumbPage>{recordRepresentation}</BreadcrumbPage>
        </Breadcrumb>
      )}
      <div
        className={cn(
          "flex justify-between items-start flex-wrap gap-2 my-2",
          className,
        )}
      >
        <h2 className="text-2xl font-bold tracking-tight">
          {title !== undefined ? title : context.defaultTitle}
        </h2>
        {actions ?? (
          <div className="flex justify-end items-center">
            {hasEdit ? <EditButton /> : null}
          </div>
        )}
      </div>
      <div className="my-2">{children}</div>
    </>
  );
};

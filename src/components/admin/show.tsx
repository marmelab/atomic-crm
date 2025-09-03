import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/admin/breadcrumb";
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
  type ShowBaseProps,
} from "ra-core";
import { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { EditButton } from "@/components/admin/edit-button";

export interface ShowProps
  extends ShowViewProps,
    Omit<ShowBaseProps, "children"> {}

export const Show = ({
  disableAuthentication,
  id,
  queryOptions,
  resource,
  actions,
  title,
  children,
  className,
  render,
  loading,
}: ShowProps) => (
  <ShowBase
    id={id}
    resource={resource}
    queryOptions={queryOptions}
    disableAuthentication={disableAuthentication}
    render={render}
    loading={loading}
  >
    <ShowView title={title} actions={actions} className={className}>
      {children}
    </ShowView>
  </ShowBase>
);

export interface ShowViewProps {
  actions?: ReactNode;
  title?: ReactNode | string | false;
  children: ReactNode;
  className?: string;
  emptyWhileLoading?: boolean;
}

export const ShowView = ({
  actions,
  title,
  children,
  className,
  emptyWhileLoading,
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

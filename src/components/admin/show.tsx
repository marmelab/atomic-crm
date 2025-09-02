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
} from "ra-core";
import { ReactNode } from "react";
import { Link } from "react-router";
import { EditButton } from "@/components/admin/edit-button";

export const Show = ({
  actions,
  title,
  children,
}: {
  actions?: ReactNode;
  title?: ReactNode | string | false;
  children: ReactNode;
}) => (
  <ShowBase>
    <ShowView title={title} actions={actions}>
      {children}
    </ShowView>
  </ShowBase>
);

export const ShowView = ({
  actions,
  title,
  children,
}: {
  actions?: ReactNode;
  title?: ReactNode | string | false;
  children: ReactNode;
}) => {
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
      <div className="flex justify-between items-start flex-wrap gap-2 my-2">
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

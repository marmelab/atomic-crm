import {
  EditBase,
  EditBaseProps,
  Translate,
  useCreatePath,
  useEditContext,
  useGetRecordRepresentation,
  useGetResourceLabel,
  useHasDashboard,
  useResourceContext,
  useResourceDefinition,
} from "ra-core";
import { ReactNode } from "react";
import { Link } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/admin/breadcrumb";
import { cn } from "@/lib/utils";
import { ShowButton } from "@/components/admin/show-button";
import { DeleteButton } from "./delete-button";

export interface EditProps extends EditViewProps, EditBaseProps {}

export const Edit = ({
  title,
  children,
  actions,
  className,
  ...rest
}: EditProps) => (
  <EditBase {...rest}>
    <EditView title={title} actions={actions} className={className}>
      {children}
    </EditView>
  </EditBase>
);

export interface EditViewProps {
  title?: ReactNode | string | false;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export const EditView = ({
  title,
  actions,
  className,
  children,
}: EditViewProps) => {
  const context = useEditContext();

  const resource = useResourceContext();
  if (!resource) {
    throw new Error(
      "The EditView component must be used within a ResourceContextProvider",
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

  const { hasShow } = useResourceDefinition({ resource });
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
          <div className="flex justify-end items-center gap-2">
            {hasShow ? <ShowButton /> : null}
            <DeleteButton />
          </div>
        )}
      </div>
      <div className="my-2">{children}</div>
    </>
  );
};

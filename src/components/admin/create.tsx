import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/admin/breadcrumb";
import type { CreateBaseProps } from "ra-core";
import {
  CreateBase,
  Translate,
  useCreateContext,
  useCreatePath,
  useGetResourceLabel,
  useHasDashboard,
  useResourceContext,
} from "ra-core";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export type CreateProps = CreateViewProps & CreateBaseProps;

export const Create = ({
  actions,
  children,
  className,
  disableBreadcrumb,
  title,
  ...rest
}: CreateProps) => (
  <CreateBase {...rest}>
    <CreateView
      actions={actions}
      className={className}
      disableBreadcrumb={disableBreadcrumb}
      title={title}
    >
      {children}
    </CreateView>
  </CreateBase>
);

export type CreateViewProps = {
  actions?: ReactNode;
  disableBreadcrumb?: boolean;
  children: ReactNode;
  className?: string;
  title?: ReactNode | string | false;
};

export const CreateView = ({
  actions,
  disableBreadcrumb,
  title,
  children,
  className,
}: CreateViewProps) => {
  const context = useCreateContext();

  const resource = useResourceContext();
  if (!resource) {
    throw new Error(
      "The CreateView component must be used within a ResourceContextProvider",
    );
  }
  const getResourceLabel = useGetResourceLabel();
  const listLabel = getResourceLabel(resource, 2);
  const createPath = useCreatePath();
  const listLink = createPath({
    resource,
    type: "list",
  });
  const hasDashboard = useHasDashboard();

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
          <BreadcrumbPage>
            <Translate i18nKey="ra.action.create">Create</Translate>
          </BreadcrumbPage>
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
        {actions}
      </div>
      <div className="my-2">{children}</div>
    </>
  );
};

import React from "react";
import { buttonVariants } from "@/components/ui/button";
import { Eye } from "lucide-react";
import type { RaRecord } from "ra-core";
import {
  LinkBase,
  useCreatePath,
  useGetRecordRepresentation,
  useGetResourceLabel,
  useRecordContext,
  useResourceContext,
  useResourceTranslation,
} from "ra-core";
import { cn } from "@/lib/utils";

export type ShowButtonProps = {
  label?: string;
  icon?: React.ReactNode;
  record?: RaRecord;
  resource?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>;

/**
 * A button that navigates to the show page for a record.
 *
 * Works within RecordContext to automatically get the record ID.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/showbutton/ ShowButton documentation}
 *
 * @example
 * import { ShowButton } from '@/components/admin';
 *
 * const PostActions = () => (
 *   <ShowButton label="View Details" />
 * );
 */
export const ShowButton = (props: ShowButtonProps) => {
  const {
    label: labelProp,
    icon,
    record: _record,
    resource: _resource,
    ...rest
  } = props;
  const resource = useResourceContext(props);
  const record = useRecordContext(props);
  const createPath = useCreatePath();
  const getResourceLabel = useGetResourceLabel();
  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const recordRepresentationValue = getRecordRepresentation(record);
  const recordRepresentation =
    typeof recordRepresentationValue === "string"
      ? recordRepresentationValue
      : recordRepresentationValue?.toString();
  const link = createPath({
    resource,
    type: "show",
    id: record?.id,
  });
  const label = useResourceTranslation({
    resourceI18nKey: resource ? `resources.${resource}.action.show` : undefined,
    baseI18nKey: "ra.action.show",
    options: {
      name: resource ? getResourceLabel(resource, 1) : undefined,
      recordRepresentation,
    },
    userText: labelProp,
  });
  return (
    <LinkBase
      className={cn(buttonVariants({ variant: "outline" }))}
      to={link}
      onClick={stopPropagation}
      aria-label={typeof label === "string" ? label : undefined}
      {...rest}
    >
      {icon ?? <Eye />}
      {label}
    </LinkBase>
  );
};

// useful to prevent click bubbling in a datagrid with rowClick
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

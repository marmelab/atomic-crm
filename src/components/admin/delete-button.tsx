import * as React from "react";
import { Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { humanize, singularize } from "inflection";
import {
  useDeleteWithUndoController,
  useGetRecordRepresentation,
  useResourceTranslation,
  useRecordContext,
  useResourceContext,
  useTranslate,
  type UseDeleteOptions,
  type RedirectionSideEffect,
} from "ra-core";

export type DeleteButtonProps = {
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  onClick?: React.ReactEventHandler<HTMLButtonElement>;
  mutationOptions?: UseDeleteOptions;
  redirect?: RedirectionSideEffect;
  resource?: string;
  successMessage?: string;
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
};

export const DeleteButton = (props: DeleteButtonProps) => {
  const {
    label: labelProp,
    onClick,
    size,
    mutationOptions,
    redirect = "list",
    successMessage,
    variant = "outline",
    className = "cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
  } = props;
  const record = useRecordContext(props);
  const resource = useResourceContext(props);

  const { isPending, handleDelete } = useDeleteWithUndoController({
    record,
    resource,
    redirect,
    onClick,
    mutationOptions,
    successMessage,
  });
  const translate = useTranslate();
  const getRecordRepresentation = useGetRecordRepresentation(resource);
  let recordRepresentation = getRecordRepresentation(record);
  const resourceName = translate(`resources.${resource}.forcedCaseName`, {
    smart_count: 1,
    _: humanize(
      translate(`resources.${resource}.name`, {
        smart_count: 1,
        _: resource ? singularize(resource) : undefined,
      }),
      true,
    ),
  });
  // We don't support React elements for this
  if (React.isValidElement(recordRepresentation)) {
    recordRepresentation = `#${record?.id}`;
  }
  const label = useResourceTranslation({
    resourceI18nKey: `resources.${resource}.action.delete`,
    baseI18nKey: "ra.action.delete",
    options: {
      name: resourceName,
      recordRepresentation,
    },
    userText: labelProp,
  });

  return (
    <Button
      variant={variant}
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      aria-label={typeof label === "string" ? label : undefined}
      size={size}
      className={className}
    >
      <Trash />
      {label}
    </Button>
  );
};

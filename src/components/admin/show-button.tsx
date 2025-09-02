import React from "react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { Eye } from "lucide-react";
import {
  Translate,
  useCreatePath,
  useRecordContext,
  useResourceContext,
} from "ra-core";

export type ShowButtonProps = { label?: string };

export const ShowButton = (props: ShowButtonProps) => {
  const resource = useResourceContext();
  const record = useRecordContext();
  const createPath = useCreatePath();
  const link = createPath({
    resource,
    type: "show",
    id: record?.id,
  });
  return (
    <Link
      className={buttonVariants({ variant: "outline" })}
      to={link}
      onClick={stopPropagation}
    >
      <Eye />
      <Translate i18nKey={props.label ?? "ra.action.show"}>
        {props.label ?? "Show"}
      </Translate>
    </Link>
  );
};

// useful to prevent click bubbling in a datagrid with rowClick
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

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

export type ShowButtonProps = {
  label?: string;
  icon?: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>;

export const ShowButton = (props: ShowButtonProps) => {
  const resource = useResourceContext();
  const record = useRecordContext();
  const createPath = useCreatePath();
  const link = createPath({
    resource,
    type: "show",
    id: record?.id,
  });
  const { label, icon, ...rest } = props;
  return (
    <Link
      className={buttonVariants({ variant: "outline" })}
      to={link}
      onClick={stopPropagation}
      {...rest}
    >
      {icon ?? <Eye />}
      <Translate i18nKey={label ?? "ra.action.show"}>
        {label ?? "Show"}
      </Translate>
    </Link>
  );
};

// useful to prevent click bubbling in a datagrid with rowClick
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

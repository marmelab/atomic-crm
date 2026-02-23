import * as React from "react";
import { useCallback } from "react";
import { Download } from "lucide-react";
import type { Exporter } from "ra-core";
import {
  fetchRelatedRecords,
  useDataProvider,
  useNotify,
  useListContext,
  Translate,
} from "ra-core";
import { Button } from "@/components/ui/button";

/**
 * A button that exports list data to a file.
 *
 * Respects current filters and sort order, with configurable maximum results.
 * Use a custom exporter to customize the result and fetch related records.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/exportbutton/ ExportButton documentation}
 *
 * @example
 * import { CreateButton, ExportButton, TopToolbar } from '@/components/admin';
 *
 * const PostListActions = () => (
 *   <>
 *     <FilterButton />
 *     <CreateButton />
 *     <ExportButton />
 *   </>
 * );
 *
 * export const PostList = () => (
 *   <List actions={<PostListActions />}>
 *     ...
 *   </List>
 * );
 */
export const ExportButton = (props: ExportButtonProps) => {
  const {
    maxResults = 1000,
    onClick,
    label = "ra.action.export",
    icon = defaultIcon,
    exporter: customExporter,
    meta,
    className = "cursor-pointer",
  } = props;
  const {
    getData,
    total,
    resource,
    exporter: exporterFromContext,
  } = useListContext();
  const exporter = customExporter || exporterFromContext;
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!getData) {
        throw new Error(
          "ListContext.getData must be defined to use ExportButton.",
        );
      }

      getData({ maxResults, meta })
        .then(
          (data) =>
            exporter &&
            exporter(
              data,
              fetchRelatedRecords(dataProvider),
              dataProvider,
              resource,
            ),
        )
        .catch((error) => {
          console.error(error);
          notify("HTTP Error", { type: "error" });
        });
      if (typeof onClick === "function") {
        onClick(event);
      }
    },
    [
      dataProvider,
      exporter,
      getData,
      notify,
      onClick,
      resource,
      maxResults,
      meta,
    ],
  );

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={total === 0}
      className={className}
    >
      {icon}
      <Translate i18nKey={label}>Export</Translate>
    </Button>
  );
};

const defaultIcon = <Download />;

export interface ExportButtonProps {
  className?: string;
  exporter?: Exporter;
  icon?: React.ReactNode;
  label?: string;
  maxResults?: number;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  resource?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: any;
}

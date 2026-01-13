import { Download } from "lucide-react";
import type { RaRecord, UseBulkExportOptions } from "ra-core";
import { Translate, useBulkExport } from "ra-core";

import { Button } from "../ui/button";

/**
 * Export the selected rows
 *
 * To be used inside the <DataTable bulkActionsButtons> prop.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/bulkexportbutton/ BulkExportButton documentation}
 *
 * @example
 * import { BulkDeleteButton, BulkExportButton, DataTable, List } from '@/components/admin';
 *
 * export const PostList = () => (
 *   <List>
 *     <DataTable
 *       bulkActionsButtons={
 *         <>
 *           <BulkExportButton />
 *           <BulkDeleteButton />
 *         </>
 *       }
 *     >
 *       ...
 *     </DataTable>
 *   </List>
 * );
 */
export const BulkExportButton = <T extends RaRecord>({
  icon = defaultIcon,
  label = "ra.action.export",
  onClick,
  ...props
}: BulkExportButtonProps<T>) => {
  const bulkExport = useBulkExport(props);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    bulkExport();
    onClick?.(event);
  };

  return (
    <Button
      onClick={handleClick}
      role="button"
      variant="outline"
      size="sm"
      className="flex items-center gap-2 h-9"
      {...sanitizeRestProps(props)}
    >
      {icon}
      {label && <Translate i18nKey={label}>{label}</Translate>}
    </Button>
  );
};

const defaultIcon = <Download className="h-4 w-4" />;

export type BulkExportButtonProps<T extends RaRecord> =
  UseBulkExportOptions<T> & {
    icon?: React.ReactNode;
    label?: string;
  } & React.ComponentProps<typeof Button>;

const sanitizeRestProps = <T extends RaRecord>({
  resource: _resource,
  exporter: _exporter,
  onClick: _onClick,
  label: _label,
  icon: _icon,
  meta: _meta,
  ...rest
}: BulkExportButtonProps<T>) => rest;

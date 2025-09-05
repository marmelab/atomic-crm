import type { Exporter } from "ra-core";
import {
  fetchRelatedRecords,
  useDataProvider,
  useListContext,
  useNotify,
  useResourceContext,
} from "ra-core";
import { useCallback, useMemo } from "react";

/**
 * This fill will be backported to 'ra-core' in the future.
 *
 * @deprecated Import from 'ra-core' instead.
 */
export function useBulkExport<
  ResourceInformationsType extends Partial<{ resource: string }>,
>(props: UseBulkExportProps<ResourceInformationsType>) {
  const { exporter: customExporter, meta } = props;

  const resource = useResourceContext(props);
  const { exporter: exporterFromContext, selectedIds } = useListContext();
  const exporter = customExporter || exporterFromContext;
  const dataProvider = useDataProvider();
  const notify = useNotify();

  const bulkExport = useCallback(() => {
    if (exporter && resource) {
      dataProvider
        .getMany(resource, { ids: selectedIds, meta })
        .then(({ data }) =>
          exporter(
            data,
            fetchRelatedRecords(dataProvider),
            dataProvider,
            resource,
          ),
        )
        .catch((error) => {
          console.error(error);
          notify("ra.notification.http_error", {
            type: "error",
          });
        });
    }
  }, [dataProvider, exporter, notify, resource, selectedIds, meta]);

  return useMemo(() => {
    return {
      bulkExport,
    };
  }, [bulkExport]);
}

export type ResourceInformation = Partial<{ resource: string }>;

export type UseBulkExportProps<T extends ResourceInformation> = T & {
  exporter?: Exporter;

  meta?: any;
};

import {
  useGetResourceLabel,
  useListContextWithProps,
  useResourceContext,
  useTranslate,
} from "ra-core";
import { Button } from "@/components/ui/button";

export const ListNoResults = (props: ListNoResultsProps) => {
  const translate = useTranslate();
  const resource = useResourceContext(props);
  const { filterValues, setFilters } = useListContextWithProps(props);
  const getResourceLabel = useGetResourceLabel();
  if (!resource) {
    throw new Error("<ListNoResults> must be used inside a <List> component");
  }
  return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">
        {filterValues && setFilters && Object.keys(filterValues).length > 0 ? (
          <>
            {translate("ra.navigation.no_filtered_results", {
              resource,
              name: getResourceLabel(resource, 0),
              _: "No results found with the current filters.",
            })}{" "}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({}, [])}
            >
              {translate("ra.navigation.clear_filters", {
                _: "Clear filters",
              })}
            </Button>
          </>
        ) : (
          translate("ra.navigation.no_results", {
            resource,
            name: getResourceLabel(resource, 0),
            _: "No results found.",
          })
        )}
      </p>
    </div>
  );
};

export interface ListNoResultsProps {
  resource?: string;
  filterValues?: any;
  setFilters?: (filters: any, filterTypes?: string[]) => void;
}

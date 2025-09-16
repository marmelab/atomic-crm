import * as React from "react";
import { useState, useEffect } from "react";
import type { RaRecord } from "ra-core";
import {
  ListBase,
  getElementsFromRecords,
  InferredElement,
  useListContext,
  usePrevious,
  useResourceContext,
} from "ra-core";
import { useLocation } from "react-router";
import type { ListProps, ListViewProps } from "@/components/admin/list";
import { ListView } from "@/components/admin/list";
import { capitalize, singularize } from "inflection";
import { DataTable } from "@/components/admin/data-table";
import { ArrayField } from "@/components/admin/array-field";
import { BadgeField } from "@/components/admin/badge-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { SingleFieldList } from "@/components/admin/single-field-list";
import { ReferenceArrayField } from "@/components/admin/reference-array-field";

export const ListGuesser = <RecordType extends RaRecord = RaRecord>(
  props: Omit<ListProps, "children"> & { enableLog?: boolean },
) => {
  const {
    debounce,
    disableAuthentication,
    disableSyncWithLocation,
    exporter,
    filter,
    filterDefaultValues,
    perPage,
    resource,
    sort,
    ...rest
  } = props;
  // force a rerender of this component when any list parameter changes
  // otherwise the ListBase won't be rerendered when the sort changes
  // and the following check won't be performed
  useLocation();
  // keep previous data, unless the resource changes
  const resourceFromContext = useResourceContext(props);
  const previousResource = usePrevious(resourceFromContext);
  const keepPreviousData = previousResource === resourceFromContext;
  return (
    <ListBase<RecordType>
      debounce={debounce}
      disableAuthentication={disableAuthentication}
      disableSyncWithLocation={disableSyncWithLocation}
      exporter={exporter}
      filter={filter}
      filterDefaultValues={filterDefaultValues}
      perPage={perPage}
      resource={resource}
      queryOptions={{
        placeholderData: (previousData) =>
          keepPreviousData ? previousData : undefined,
      }}
      sort={sort}
    >
      <ListViewGuesser {...rest} />
    </ListBase>
  );
};

const ListViewGuesser = (
  props: Omit<ListViewProps, "children"> & { enableLog?: boolean },
) => {
  const { data } = useListContext();
  const resource = useResourceContext();
  const [child, setChild] = useState<React.ReactElement | null>(null);
  const { enableLog = process.env.NODE_ENV === "development", ...rest } = props;

  useEffect(() => {
    setChild(null);
  }, [resource]);

  useEffect(() => {
    if (data && data.length > 0 && !child) {
      const inferredElements = getElementsFromRecords(data, listFieldTypes);
      const inferredChild = new InferredElement(
        listFieldTypes.table,
        null,
        inferredElements,
      );
      const inferredChildElement = inferredChild.getElement();
      const representation = inferredChild.getRepresentation();
      if (!resource) {
        throw new Error(
          "Cannot use <ListGuesser> outside of a ResourceContext",
        );
      }
      if (!inferredChildElement || !representation) {
        return;
      }

      setChild(inferredChildElement);

      const components = ["List"]
        .concat(
          Array.from(
            new Set(
              Array.from(representation.matchAll(/<([^/\s\\.>]+)/g))
                .map((match) => match[1])
                .filter((component) => component !== "span"),
            ),
          ),
        )
        .sort();

      if (enableLog) {
        console.log(
          `Guessed List:

${components
  .map(
    (component) =>
      `import { ${component} } from "@/components/admin/${kebabCase(
        component,
      )}";`,
  )
  .join("\n")}

export const ${capitalize(singularize(resource))}List = () => (
    <List>
${inferredChild.getRepresentation()}
    </List>
);`,
        );
      }
    }
  }, [data, child, resource, enableLog]);

  return <ListView {...rest}>{child}</ListView>;
};

const listFieldTypes = {
  table: {
    component: (props: any) => {
      return <DataTable {...props} />;
    },
    representation: (
      _props: any,
      children: { getRepresentation: () => string }[],
    ) =>
      `        <DataTable>
${children
  .map((child) => `            ${child.getRepresentation()}`)
  .join("\n")}
        </DataTable>`,
  },

  reference: {
    component: (props: any) => (
      <DataTable.Col source={props.source}>
        <ReferenceField source={props.source} reference={props.reference} />
      </DataTable.Col>
    ),
    representation: (props: any) =>
      `<DataTable.Col source="${props.source}">
                <ReferenceField source="${props.source}" reference="${props.reference}" />
            </DataTable.Col>`,
  },
  array: {
    component: ({ children, ...props }: any) => {
      const childrenArray = React.Children.toArray(children);
      return (
        <DataTable.Col source={props.source}>
          <ArrayField source={props.source}>
            <SingleFieldList>
              <BadgeField
                source={
                  childrenArray.length > 0 &&
                  React.isValidElement(childrenArray[0]) &&
                  (childrenArray[0].props as any).source
                }
              />
            </SingleFieldList>
          </ArrayField>
        </DataTable.Col>
      );
    },
    representation: (props: any, children: any) =>
      `<DataTable.Col source="${props.source}">
               <ArrayField source="${props.source}">
                    <SingleFieldList>
                        <BadgeField source="${
                          children.length > 0 && children[0].getProps().source
                        }" />
                   </SingleFieldList>
                </ArrayField>
            </DataTable.Col>`,
  },
  referenceArray: {
    component: (props: any) => (
      <DataTable.Col {...props}>
        <ReferenceArrayField {...props} />
      </DataTable.Col>
    ),
    representation: (props: any) =>
      `<DataTable.Col source="${props.source}">
                <ReferenceArrayField source="${props.source}" reference="${props.reference}" />
            </DataTable.Col>`,
  },
  string: {
    component: DataTable.Col,
    representation: (props: any) =>
      `<DataTable.Col source="${props.source}" />`,
  },
};

const kebabCase = (name: string) => {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
};

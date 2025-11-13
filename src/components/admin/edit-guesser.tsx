import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { InferredTypeMap } from "ra-core";
import {
  EditBase,
  InferredElement,
  useResourceContext,
  useEditContext,
  getElementsFromRecords,
} from "ra-core";
import { capitalize, singularize } from "inflection";
import { EditView } from "@/components/admin/edit";
import { SimpleForm } from "@/components/admin/simple-form";
import { TextInput } from "@/components/admin/text-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";

export const EditGuesser = (props: { enableLog?: boolean }) => {
  return (
    <EditBase>
      <EditViewGuesser {...props} />
    </EditBase>
  );
};

const EditViewGuesser = (props: { enableLog?: boolean }) => {
  const resource = useResourceContext();

  if (!resource) {
    throw new Error(`Cannot use <EditGuesser> outside of a ResourceContext`);
  }

  const { record } = useEditContext();
  const [child, setChild] = useState<ReactNode>(null);
  const { enableLog = process.env.NODE_ENV === "development", ...rest } = props;

  useEffect(() => {
    setChild(null);
  }, [resource]);

  useEffect(() => {
    if (record && !child) {
      const inferredElements = getElementsFromRecords([record], editFieldTypes);
      const inferredChild = new InferredElement(
        editFieldTypes.form,
        null,
        inferredElements,
      );
      setChild(inferredChild.getElement());

      if (!enableLog) return;

      const representation = inferredChild.getRepresentation();

      const components = ["Edit"]
        .concat(
          Array.from(
            new Set(
              Array.from(representation.matchAll(/<([^/\s>]+)/g))
                .map((match) => match[1])
                .filter((component) => component !== "span"),
            ),
          ),
        )
        .sort();

      // eslint-disable-next-line no-console
      console.log(
        `Guessed Edit:

${components
  .map(
    (component) =>
      `import { ${component} } from "@/components/admin/${kebabCase(
        component,
      )}";`,
  )
  .join("\n")}

export const ${capitalize(singularize(resource))}Edit = () => (
    <Edit>
${representation}
    </Edit>
);`,
      );
    }
  }, [record, child, resource, enableLog]);

  return <EditView {...rest}>{child}</EditView>;
};

const editFieldTypes: InferredTypeMap = {
  form: {
    component: (props: any) => <SimpleForm {...props} />,
    representation: (
      _props: any,
      children: { getRepresentation: () => string }[],
    ) => `        <SimpleForm>
${children
  .map((child) => `            ${child.getRepresentation()}`)
  .join("\n")}
        </SimpleForm>`,
  },
  reference: {
    component: (props: any) => (
      <ReferenceInput source={props.source} reference={props.reference}>
        <AutocompleteInput />
      </ReferenceInput>
    ),
    representation: (props: any) =>
      `<ReferenceInput source="${props.source}" reference="${props.reference}">
                  <AutocompleteInput />
              </ReferenceInput>`,
  },
  referenceArray: {
    component: (props: any) => <ReferenceArrayInput {...props} />,
    representation: (props: any) =>
      `<ReferenceArrayInput source="${props.source}" reference="${props.reference}" />`,
  },
  boolean: {
    component: (props: any) => <BooleanInput {...props} />,
    representation: (props: any) => `<BooleanInput source="${props.source}" />`,
  },
  string: {
    component: (props: any) => <TextInput {...props} />,
    representation: (props: any) => `<TextInput source="${props.source}" />`,
  },
};

const kebabCase = (name: string) => {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
};

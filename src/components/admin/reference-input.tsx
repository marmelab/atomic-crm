import { ReferenceInputBase, ReferenceInputBaseProps } from "ra-core";
import { AutocompleteInput } from "./autocomplete-input";

export const ReferenceInput = (props: ReferenceInputProps) => {
  const { children = defaultChildren, ...rest } = props;

  if (props.validate && process.env.NODE_ENV !== "production") {
    throw new Error(
      "<ReferenceInput> does not accept a validate prop. Set the validate prop on the child instead.",
    );
  }

  return <ReferenceInputBase {...rest}>{children}</ReferenceInputBase>;
};

const defaultChildren = <AutocompleteInput />;

export interface ReferenceInputProps extends ReferenceInputBaseProps {
  /**
   * Call validate on the child component instead
   */
  validate?: never;
}

import type { HTMLAttributes } from "react";
import type { ChoicesProps } from "ra-core";
import { useChoices, useFieldValue, useTranslate } from "ra-core";

import type { FieldProps } from "@/lib/field.type";
import { genericMemo } from "@/lib/genericMemo";

/**
 * Display a value in an enumeration
 *
 * Pass possible options as an array of objects in the 'choices' attribute.
 *
 * @example
 * const choices = [
 *    { id: 'M', name: 'Male' },
 *    { id: 'F', name: 'Female' },
 * ];
 * <SelectField source="gender" choices={choices} />
 *
 * By default, the text is built by
 * - finding a choice where the 'id' property equals the field value
 * - using the 'name' property as the option text
 *
 * You can also customize the properties to use for the value and text,
 * thanks to the 'optionValue' and 'optionText' attributes.
 *
 * @example
 * const choices = [
 *    { _id: 123, full_name: 'Leo Tolstoi', sex: 'M' },
 *    { _id: 456, full_name: 'Jane Austen', sex: 'F' },
 * ];
 * <SelectField source="author_id" choices={choices} optionText="full_name" optionValue="_id" />
 *
 * `optionText` also accepts a function, so you can shape the option text at will:
 * @example
 * const choices = [
 *    { id: 123, first_name: 'Leo', last_name: 'Tolstoi' },
 *    { id: 456, first_name: 'Jane', last_name: 'Austen' },
 * ];
 * const optionRenderer = choice => `${choice.first_name} ${choice.last_name}`;
 * <SelectField source="author_id" choices={choices} optionText={optionRenderer} />
 *
 * `optionText` also accepts a React Element, that can access
 * the related choice through the `useRecordContext` hook. You can use Field components there.
 * @example
 * const choices = [
 *    { id: 123, first_name: 'Leo', last_name: 'Tolstoi' },
 *    { id: 456, first_name: 'Jane', last_name: 'Austen' },
 * ];
 * const FullNameField = () => {
 *     const record = useRecordContext();
 *     return (<Chip>{record.first_name} {record.last_name}</Chip>)
 * };
 * <SelectField source="gender" choices={choices} optionText={<FullNameField />}/>
 *
 * The current choice is translated by default, so you can use translation identifiers as choices:
 * @example
 * const choices = [
 *    { id: 'M', name: 'myroot.gender.male' },
 *    { id: 'F', name: 'myroot.gender.female' },
 * ];
 *
 * However, in some cases (e.g. inside a `<ReferenceField>`), you may not want
 * the choice to be translated. In that case, set the `translateChoice` prop to false.
 * @example
 * <SelectField source="gender" choices={choices} translateChoice={false}/>
 *
 * **Tip**: <ReferenceField> sets `translateChoice` to false by default.
 */
const SelectFieldImpl = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends Record<string, any> = Record<string, any>,
>(
  props: SelectFieldProps<RecordType>,
) => {
  const {
    className,
    empty,
    choices,
    defaultValue,
    source,
    record,
    optionValue = "id",
    optionText = "name",
    translateChoice = true,
    ...rest
  } = props;
  const value = useFieldValue({ defaultValue, source, record });

  const { getChoiceText, getChoiceValue } = useChoices({
    optionText,
    optionValue,
    translateChoice,
  });
  const translate = useTranslate();

  const choice = choices
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      choices.find((choice: any) => getChoiceValue(choice) === value)
    : null;

  if (!choice) {
    if (!empty) {
      return null;
    }

    return (
      <span className={className} {...rest}>
        {typeof empty === "string" ? translate(empty, { _: empty }) : empty}
      </span>
    );
  }

  const choiceText = getChoiceText(choice);

  return (
    <span className={className} {...rest}>
      {choiceText}
    </span>
  );
};

SelectFieldImpl.displayName = "SelectFieldImpl";

export const SelectField = genericMemo(SelectFieldImpl);

export interface SelectFieldProps<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends Record<string, any> = Record<string, any>,
> extends Omit<
      ChoicesProps,
      "disableValue" | "createValue" | "createHintValue"
    >,
    FieldProps<RecordType>,
    HTMLAttributes<HTMLSpanElement> {}

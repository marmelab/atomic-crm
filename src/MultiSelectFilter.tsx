import { useMemo, useEffect } from 'react';
import {
    useListFilterContext,
    AutocompleteArrayInput,
    AutocompleteArrayInputProps,
    useEvent,
    CommonInputProps,
} from 'react-admin';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import isEqual from 'lodash/isEqual';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import sortBy from 'lodash/sortBy';
import unionBy from 'lodash/unionBy';

const handleFilterFormSubmit = (event: any) => {
    event.preventDefault();
    event.stopPropagation();
    return false;
};

type TMultiSelectFilterProps<
    T extends Record<string, any> & {
        _row_count?: number;
        _display_name?: string;
    },
> = {
    /** column name that contains filter value to apply */
    source: keyof T & string;
    /** column name that contains display name for selected filter value; if not provided, `source` is used */
    source_display_name?: keyof T & string;
    choices?: T[];
    isLoading: boolean;
    error?: Error | null;
    label?: CommonInputProps['label'];
    /**
     * indicates that a filter should be wrapped into a form component
     */
    useForm?: boolean;
    disableSort?: boolean;
} & Pick<CommonInputProps, 'alwaysOn'> &
    Pick<AutocompleteArrayInputProps, 'sx'>;

const View = <T extends { [x: string]: any }>(
    props: TMultiSelectFilterProps<T>
) => {
    const {
        source,
        choices,
        isLoading,
        error,
        label,
        sx,
        disableSort = false,
        source_display_name,
    } = props;

    const { filterValues, displayedFilters, setFilters } =
        useListFilterContext();
    const { setValue, getValues } = useFormContext();

    /** set value if filter is different from formValue (this is possible on form load) */
    useEffect(() => {
        const filterV = filterValues[source] ?? [];
        const formV = getValues(source) ?? [];
        if (!isEqual(filterV, formV)) {
            setValue(source, filterV);
        }
    }, [filterValues, source, setValue, getValues]);

    const handleChange = useEvent(
        (
            /** array of selected values */
            _values: any[],
            /** array of selected option objects */
            options: any[]
        ) => {
            /** array of string of selected values */
            const arr = options.map(opt => opt[source] as string);

            const newFilters = { ...filterValues };
            if (arr.length === 0) delete newFilters[source];
            else newFilters[source] = arr;

            if (!isEqual(newFilters, filterValues))
                setFilters(newFilters, displayedFilters);
        }
    );

    const allChoices = useMemo(() => {
        if (disableSort) return choices;
        return sortBy(choices, source);

        /**
         * the following code is disable for now:
         * until https://github.com/marmelab/react-admin/issues/9490) is addressed
         *
         * the intent is to show fields that are selected but have 0 counts due to other filters
         */

        const filterValuesAr = filterValues[source] ?? [];

        const filterValueChoices = filterValuesAr.map((val: string) => ({
            project_type: val,
            _row_count: 0,
            id: val,
        }));
        const newChoices = unionBy(choices, filterValueChoices, source);
        const cloned = newChoices?.map(v => ({ ...v, label: v[source] }));

        return sortBy(cloned, source);
    }, [choices, source, disableSort, filterValues]);

    const optionText = (choice: Record<string, any>) => {
        const value_str = choice[source];
        const display_str = choice[source_display_name ?? source];
        const str = display_str ?? value_str;
        return choice._row_count !== undefined
            ? `${str} (${choice._row_count})`
            : `${str}`;
    };

    const renderTags = (values: Record<string, any>, getTagProps: any) => {
        return values.map((option: any, index: number) => {
            const name = optionText(option);

            const { key, ...rest } = getTagProps({ index });

            return (
                <Tooltip key={option.id} title={name} placement="right-end">
                    <Chip key={option.id} label={name} size="small" {...rest} />
                </Tooltip>
            );
        });
    };

    const isOptionEqualToValue = (option: any, value: any) =>
        option[source] === value[source];

    return (
        <AutocompleteArrayInput
            disableCloseOnSelect
            blurOnSelect={false}
            optionText={optionText}
            optionValue={source}
            onChange={handleChange}
            isOptionEqualToValue={isOptionEqualToValue}
            label={label}
            noOptionsText={
                error && !choices ? 'Failed to load options' : 'No options'
            }
            multiple
            choices={allChoices ?? []}
            isLoading={isLoading}
            renderTags={renderTags}
            // filterSelectedOptions={false}
            source={source}
            sx={sx}
        />
    );
};

export const MultiSelectFilter = <T extends Record<string, any>>(
    props: TMultiSelectFilterProps<T>
) => {
    const { filterValues } = useListFilterContext();
    const { source } = props;

    const defaultValues = { [source]: filterValues[source] };

    const { useForm: useFormProp, ...rest } = props;
    const formMethods = useForm({ defaultValues });

    if (useFormProp) {
        return (
            <FormProvider {...formMethods}>
                <form
                    onSubmit={formMethods.handleSubmit(handleFilterFormSubmit)}
                >
                    <View {...rest} />
                </form>
            </FormProvider>
        );
    }

    return <View {...rest} />;
};

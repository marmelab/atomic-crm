import {
    useListFilterContext,
    useResourceContext,
    useGetList,
    ListBaseProps,
} from 'react-admin';
import { useMemo } from 'react';
import { MultiSelectFilter } from './MultiSelectFilter';

export const GroupByFilter = (props: {
    source: string;
    source_id?: string;
    resource?: string;
    label: string;
    /** if provided, keys are mapped to display names*/
    mapping?: Record<string, string>;
    mapping_null?: string;
    /** stafic filters to be added */
    filter?: ListBaseProps['filter'];
}) => {
    const resource_context = useResourceContext();
    const resource = props.resource ?? resource_context!;

    const mapping = props.mapping;
    const mapping_null = props.mapping_null;

    const { filterValues: currentFilters } = useListFilterContext();

    const filter = { ...currentFilters, ...(props.filter ?? {}) };
    delete filter[props.source];
    if (props.source_id) delete filter[props.source_id];

    const filter_value_source = props.source_id ?? props.source;

    const meta = {
        columns: [
            props.source,
            props.source_id,
            `_row_count:${props.source}.count()`,
        ].filter(v => v !== undefined),
    };

    const {
        data: choices,
        isLoading,
        error,
    } = useGetList(
        resource,

        {
            pagination: { page: 1, perPage: 1000 },
            sort: { field: `${props.source}`, order: 'ASC' },
            filter: filter,
            meta: meta,
        },
        {
            refetchOnWindowFocus: true,
            retry: 0,
            refetchOnMount: false,
            refetchOnReconnect: false,
        }
    );

    const updated_choices = useMemo(() => {
        if (!choices) return choices;

        const data = choices.map(v => {
            return {
                ...v,
                _display_name: v[props.source],
            };
        });

        if (data && mapping) {
            const d = data.map(v => {
                let value = v.name;
                if (value === null && mapping_null !== undefined)
                    value = mapping_null;
                else if (value !== null && value !== undefined)
                    value = mapping[value] ?? value;

                return { ...v, _display_name: value };
            });

            return d;
        }
        return data;
    }, [choices, mapping, props.source, mapping_null]);

    return (
        <MultiSelectFilter
            source={filter_value_source}
            choices={updated_choices}
            source_display_name="_display_name"
            isLoading={isLoading}
            error={error}
            useForm
            label={props.label}
        />
    );
};

import { DataProvider } from 'react-admin';
import { transformInFilter } from './internal/transformInFilter';

function transformFilter(filter: Record<string, any>) {
    const transformedFilters: Record<string, any> = {};
    for (const [key, value] of Object.entries(filter)) {
        if (key.endsWith('@in')) {
            transformedFilters[`${key.slice(0, -3)}_eq_any`] =
                transformInFilter(value);
            continue;
        }

        transformedFilters[key] = value;
    }
    return transformedFilters;
}

export function withSupabaseFilterAdapter<T extends DataProvider>(
    dataProvider: T
): T {
    return {
        ...dataProvider,
        getList(resource, params) {
            return dataProvider.getList(resource, {
                ...params,
                filter: transformFilter(params.filter),
            });
        },
        getManyReference(resource, params) {
            return dataProvider.getManyReference(resource, {
                ...params,
                filter: transformFilter(params.filter),
            });
        },
    };
}

import { DataProvider } from 'react-admin';
import { transformFilter } from './transformFilter';

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

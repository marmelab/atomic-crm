import { Identifier } from 'ra-core';

import isArray from 'lodash/isArray';
import pick from 'lodash/pick';

/**
 * Interface to clearly seperate the operator like < oder >
 * from the name and the value of the filter
 */
interface PostgRestFilter {
    name: string;
    operator?: PostgRestOperator;
    value: string;
}

/**
 * List of all possible operators in PostgRest
 * (https://postgrest.org/en/stable/api.html#operators)
 */
const postgrestOperators = [
    'eq',
    'gt',
    'gte',
    'lt',
    'lte',
    'neq',
    'like',
    'ilike',
    'match',
    'imatch',
    'in',
    'is',
    'fts',
    'plfts',
    'phfts',
    'wfts',
    'cs',
    'cd',
    'ov',
    'sl',
    'sr',
    'nxr',
    'nxl',
    'adj',
    'not',
    'or',
    'and',
    'not.in',
] as const;

type ParsedFiltersResult = {
    filter: any;
    select: any;
};

const isObject = (obj: any) =>
    typeof obj === 'object' && !Array.isArray(obj) && obj !== null;

const resolveKeys = (filter: any, keys: Array<any>) => {
    let result = filter[keys[0]];
    for (let i = 1; i < keys.length; ++i) {
        result = result[keys[i]];
    }

    return result;
};

export type PostgRestOperator = (typeof postgrestOperators)[number];

const KEY = 'q9';

/**
 * escapes special characters in strings;
 * removes empty values
 * */
const escape = <T extends any = any>(str: T): T | undefined => {
    if (isArray(str)) {
        const ret: any[] = str
            .filter(v => v !== null && v !== undefined)
            .map((v: any) => {
                return escape(v) as any;
            }) as any;

        if (ret.length === 0) return undefined;

        return ret as any;
    }

    if (str === null) return undefined;

    if (typeof str === 'string') {
        // replace double quote with \"
        let ret = str.replace(/"/g, '\\"');

        //replace \ with \\
        ret = ret.replace(/\\/g, '\\\\');

        // check if string contains ,.:()[]"\" characters;
        if (ret.match(/[,:.()\[\]"]/)) {
            ret = `"${str}"`;
        }
    }

    return str;
};

export const parseFilters = (
    params: any,
    defaultListOp: PostgRestOperator | '' = 'eq'
): Partial<ParsedFiltersResult> => {
    const { filter, meta = {} } = params;

    let result: Partial<ParsedFiltersResult> = {};
    result.filter = {};

    /**
    see https://github.com/raphiniert-com/ra-data-postgrest/issues/58

    `<TextInput source="prices.name@ilike" label="search" />` will create `{ prices: { "name@ilike": "tickets"}}`

    we need to translate this object to {"prices.name@ilike":"tickets"}

    */
    const filter2: Record<
        string,
        {
            key: string;
            values:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | undefined;
            /** formatted value
             * @see https://docs.postgrest.org/en/v12/references/api/tables_views.html
             */
            queryString: string | string[];
            operation: PostgRestOperator | '';
            isDefaultOperation: boolean;
        }
    > = {};
    Object.keys(filter).forEach(function (key) {
        const filterValueParam:
            | string
            | number
            | boolean
            | Array<string>
            | Array<number>
            | Record<string, any> = filter[key];

        let values: string | number | boolean | Array<string> | Array<number>;

        if (
            key.split('@')[0] && // has column name
            isObject(filterValueParam) // object, which indicates nested keys
        ) {
            let innerVal = filterValueParam;
            let keyArray = [key];

            do {
                const inner = resolveKeys(filter, keyArray);
                const [innerKey] = Object.keys(inner);

                keyArray.push(innerKey);
                innerVal = inner[innerKey];
            } while (isObject(innerVal));

            key = keyArray.join('.');
            values = innerVal as any;
        } else {
            values = filterValueParam as any;
        }

        const splitKey = key.split('@');

        filter2[key] = {
            key: splitKey[0],
            operation: (splitKey[1] as PostgRestOperator) || defaultListOp,
            values: values,
            queryString: '',
            isDefaultOperation: splitKey[1] === undefined,
        };
    });

    Object.keys(filter2).forEach(function (key: string) {
        const f = filter2[key];

        // convert string to array of search terms
        if (
            typeof f.values === 'string' &&
            ['like', 'ilike'].includes(f.operation)
        ) {
            // convert string to array of search terms
            f.values = f.values.trim().split(/\s+/);

            f.values = escape(f.values);
            if (f.values)
                f.queryString = f.values
                    .filter(v => !!v)
                    .map(v => `${f.operation}.*${v}*`);
        }
        // correct opperation eq->in for arrays of values
        else if (
            f.operation === 'eq' &&
            f.isDefaultOperation &&
            isArray(f.values)
        ) {
            f.operation = 'in';
            f.values = escape(f.values);
            if (f.values)
                f.queryString = `${f.operation}.(${f.values.join(',')})`;
        }
        // correct opperation neq->not.in for arrays of values
        else if (
            f.operation === 'neq' &&
            f.isDefaultOperation &&
            isArray(f.values)
        ) {
            f.operation = 'not.in';
            f.values = escape(f.values);
            if (f.values)
                f.queryString = `${f.operation}.(${f.values.join(',')})`;
        } else if (['or', 'and'].includes(f.operation)) {
            // recursively compute filter values
            // we extract each value entries and make it dot separated string.
            const { filter: subFilter } = parseFilters(
                { filter: f.values },
                defaultListOp
            );

            const filterExpressions: string[] = [];
            Object.entries(subFilter).forEach(([op, val]) => {
                if (Array.isArray(val))
                    filterExpressions.push(...val.map(v => [op, v].join('.')));
                else filterExpressions.push([op, val].join('.'));
            });
            f.queryString = `${f.operation}.(${filterExpressions.join(',')})`;
        } else if (f.operation === '') {
            f.values = escape(f.values);
            if (f.values === undefined) return;
            f.queryString = `${f.values}`;
        } else {
            f.values = escape(f.values);
            if (f.values === undefined) return;
            f.queryString = `${f.operation}.${f.values}`;
        }
    });

    Object.keys(filter2).forEach(function (k) {
        const f = filter2[k];

        if (['and', 'or'].includes(f.operation)) {
            result.filter[f.operation] = f.queryString;
        } else {
            if (f.queryString === '') return;
            if (isArray(f.queryString) && f.queryString.length === 0) return;

            if (isArray(f.queryString) && f.queryString.length === 1) {
                result.filter[f.key] = f.queryString[0];
            } else {
                result.filter[f.key] = f.queryString;
            }
        }
    });

    if (meta?.columns) {
        result.select = Array.isArray(meta.columns)
            ? meta.columns.join(',')
            : meta.columns;
    }

    return result;
};

const filter = {
    q1: 'foo',
    'q2@ilike': 'bar',
    'q3@like': 'baz qux',
    'q4@gt': 'c',
    'q5@cs': '{foo}',
    'q6@cs': '{foo,bar}',
    'q7@cd': '{foo}',
    'q8@cd': '{foo,bar}',
    q9: { 'foo@ilike': 'bar' },
    q10: { 'foo@like': 'baz qux' },
    q11: { 'foo@gt': 'c' },
    q12: { 'foo@cs': '{bar}' },
    q13: { 'foo@cs': '{foo,bar}' },
    q14: { 'foo@cd': '{bar}' },
    q15: { 'foo@cd': '{foo,bar}' },
    q16: { foo: { 'bar@cs': '{foo,bar}' } },
    'q17@cd': '["foo","bar"]',
    'q18@cd': JSON.stringify({ foo: 'bar' }),
    '@or': {
        'age@lt': 18,
        'age@gt': 21,
        q1: 'foo',
        'q2@ilike': 'bar',
        'q3@like': 'baz qux',
        'q4@gt': 'c',
    },
} as any;

// compound keys capability
export type PrimaryKey = Array<string>;

export const getPrimaryKey = (
    resource: string,
    primaryKeys: Map<string, PrimaryKey>
) => {
    return (primaryKeys && primaryKeys.get(resource)) || ['id'];
};

export const decodeId = (
    id: Identifier,
    primaryKey: PrimaryKey
): string[] | number[] => {
    if (isCompoundKey(primaryKey)) {
        return JSON.parse(id.toString());
    } else {
        return [id.toString()];
    }
};

export const encodeId = (data: any, primaryKey: PrimaryKey): Identifier => {
    if (isCompoundKey(primaryKey)) {
        return JSON.stringify(primaryKey.map(key => data[key]));
    } else {
        return data[primaryKey[0]];
    }
};

export const removePrimaryKey = (data: any, primaryKey: PrimaryKey) => {
    const newData = { ...data };
    primaryKey.forEach(key => {
        delete newData[key];
    });
    return newData;
};

export const dataWithVirtualId = (data: any, primaryKey: PrimaryKey) => {
    if (primaryKey.length === 1 && primaryKey[0] === 'id') {
        return data;
    }

    return Object.assign(data, {
        id: encodeId(data, primaryKey),
    });
};

export const dataWithoutVirtualId = (data: any, primaryKey: PrimaryKey) => {
    if (primaryKey.length === 1 && primaryKey[0] === 'id') {
        return data;
    }

    const { id, ...dataWithoutId } = data;
    return dataWithoutId;
};

const isCompoundKey = (primaryKey: PrimaryKey): Boolean => {
    return primaryKey.length > 1;
};

export const getQuery = (
    primaryKey: PrimaryKey,
    ids: Identifier | Array<Identifier> | undefined,
    resource: string,
    meta: any = null
): any => {
    let result: any = {};
    if (Array.isArray(ids) && ids.length > 1) {
        // no standardized query with multiple ids possible for rpc endpoints which are api-exposed database functions
        if (resource.startsWith('rpc/')) {
            console.error(
                "PostgREST's rpc endpoints are not intended to be handled as views. Therefore, no query generation for multiple key values implemented!"
            );

            return;
        }

        if (isCompoundKey(primaryKey)) {
            result = {
                or: `(${ids.map(id => {
                    const primaryKeyParams = decodeId(id, primaryKey);
                    return `and(${primaryKey
                        .map((key, i) => `${key}.eq.${primaryKeyParams[i]}`)
                        .join(',')})`;
                })})`,
            };
        } else {
            result = {
                [primaryKey[0]]: `in.(${ids.join(',')})`,
            };
        }
    } else if (ids) {
        // if ids is one Identifier
        const id: Identifier = ids.toString();
        const primaryKeyParams = decodeId(id, primaryKey);

        if (isCompoundKey(primaryKey)) {
            if (resource.startsWith('rpc/')) {
                result = {};
                primaryKey.map(
                    (key: string, i: any) =>
                        (result[key] = `${primaryKeyParams[i]}`)
                );
            } else {
                result = {
                    and: `(${primaryKey.map(
                        (key: string, i: any) =>
                            `${key}.eq.${primaryKeyParams[i]}`
                    )})`,
                };
            }
        } else {
            result = {
                [primaryKey[0]]: `eq.${id}`,
            };
        }
    }

    if (meta && meta.columns) {
        result.select = Array.isArray(meta.columns)
            ? meta.columns.join(',')
            : meta.columns;
    }

    return result;
};

export const enum PostgRestSortOrder {
    AscendingNullsLastDescendingNullsFirst = 'asc,desc',
    AscendingNullsLastDescendingNullsLast = 'asc,desc.nullslast',
    AscendingNullsFirstDescendingNullsFirst = 'asc.nullsfirst,desc',
    AscendingNullsFirstDescendingNullsLast = 'asc.nullsfirst,desc.nullslast',
}

export const getOrderBy = (
    field: string,
    order: string,
    primaryKey: PrimaryKey,
    sortOrder: PostgRestSortOrder = PostgRestSortOrder.AscendingNullsLastDescendingNullsFirst
) => {
    const postgRestOrder = sortOrder.split(',')[order === 'ASC' ? 0 : 1];
    if (field == 'id') {
        return primaryKey.map(key => `${key}.${postgRestOrder}`).join(',');
    } else {
        return `${field}.${postgRestOrder}`;
    }
};

// https://github.com/marmelab/ra-supabase/blob/main/packages/ra-supabase-core/src/dataProvider.ts

import { DataProvider, fetchUtils } from 'ra-core';
import postgrestRestProvider, {
    IDataProviderConfig,
    defaultPrimaryKeys,
    defaultSchema,
} from '../ra-data-postgrest';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OpenAPIV2 } from 'openapi-types';

/**
 * A function that returns a dataProvider for Supabase.
 * @param instanceUrl The URL of the Supabase instance
 * @param apiKey The API key of the Supabase instance. Prefer the anonymous key.
 * @param supabaseClient The Supabase client
 * @param httpClient Optional - The httpClient to use. Defaults to a httpClient that handles the authentication.
 * @param defaultListOp Optional - The default list filter operator. Defaults to 'eq'.
 * @param primaryKeys Optional - The primary keys of the tables. Defaults to 'id'.
 * @param schema Optional - The custom schema to use. Defaults to none.
 * @returns A dataProvider for Supabase
 */
export const supabaseDataProvider = ({
    instanceUrl,
    apiKey,
    supabaseClient = createClient(instanceUrl, apiKey),
    httpClient = supabaseHttpClient({ apiKey, supabaseClient }),
    defaultListOp = 'eq',
    primaryKeys = defaultPrimaryKeys,
    schema = defaultSchema,
    ...rest
}: {
    instanceUrl: string;
    apiKey: string;
    supabaseClient?: SupabaseClient;
} & Partial<Omit<IDataProviderConfig, 'apiUrl'>>): DataProvider => {
    const config: IDataProviderConfig = {
        apiUrl: `${instanceUrl}/rest/v1`,
        httpClient,
        defaultListOp,
        primaryKeys,
        schema,
        ...rest,
    };
    return {
        supabaseClient: (url: string, options?: any) =>
            httpClient(`${config.apiUrl}/${url}`, options),
        getSchema: async (): Promise<OpenAPIV2.Document> => {
            const { json } = await httpClient(`${config.apiUrl}/`, {});
            if (!json || !json.swagger) {
                throw new Error('The Open API schema is not readable');
            }
            return json;
        },
        ...postgrestRestProvider(config),
    };
};

/**
 * A function that returns a httpClient for Supabase. It handles the authentication.
 * @param apiKey The API key of the Supabase instance. Prefer the anonymous key.
 * @param supabaseClient The Supabase client
 * @returns A httpClient for Supabase
 */
export const supabaseHttpClient =
    ({
        apiKey,
        supabaseClient,
    }: {
        apiKey: string;
        supabaseClient: SupabaseClient;
    }) =>
    async (url: string, options: any = {}) => {
        const { data } = await supabaseClient.auth.getSession();

        if (!options.headers) {
            // eslint-disable-next-line no-param-reassign
            options.headers = new Headers({});
        }

        if (supabaseClient['headers']) {
            Object.entries(supabaseClient['headers']).forEach(([name, value]) =>
                options.headers.set(name, value)
            );
        }
        if (data.session) {
            // eslint-disable-next-line no-param-reassign
            options.user = {
                authenticated: true,
                // This ensures that users are identified correctly and that RLS can be applied
                token: `Bearer ${data.session.access_token}`,
            };
        }
        // Always send the apiKey even if there isn't a session
        options.headers.set('apiKey', apiKey);

        return fetchUtils.fetchJson(url, options);
    };

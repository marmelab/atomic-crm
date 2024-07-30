import { supabaseDataProvider } from 'ra-supabase';

import {
    DataProvider,
    GetListParams,
    Identifier,
    withLifecycleCallbacks,
} from 'react-admin';
import { getActivityLog } from './dataProvider/activity';
import { supabase } from './supabase';
import { Deal, Sale, SalesFormData, SignUpData } from './types';

if (import.meta.env.VITE_SUPABASE_URL === undefined) {
    throw new Error('Please set the VITE_SUPABASE_URL environment variable');
}
if (import.meta.env.VITE_SUPABASE_ANON_KEY === undefined) {
    throw new Error(
        'Please set the VITE_SUPABASE_ANON_KEY environment variable'
    );
}

const baseDataProvider = supabaseDataProvider({
    instanceUrl: import.meta.env.VITE_SUPABASE_URL,
    apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    supabaseClient: supabase,
});

const dataProviderWithCustomMethods = {
    ...baseDataProvider,
    async signUp({ email, password, first_name, last_name }: SignUpData) {
        const response = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    first_name,
                    last_name,
                },
            },
        });

        if (!response.data?.user || response.error) {
            console.error('signUp.error', response.error);
            throw new Error('Failed to create account');
        }

        return {
            id: response.data.user.id,
            email,
            password,
        };
    },
    async salesCreate({ administrator, ...signUpData }: SalesFormData) {
        const { data, error } = await supabase.functions.invoke<{
            user: { id: Identifier };
        }>('users', {
            method: 'POST',
            body: signUpData,
        });

        if (!data?.user || error) {
            console.error('salesCreate.error', error);
            throw new Error('Failed to create user');
        }

        console.log('data.user.id', data.user.id);

        // We need to update sale administrator role here as we can't do it in signUp method as
        // it is not supported in the trigger for security reasons.
        const { data: users, error: userError } = await supabase
            .from('sales')
            .update({ administrator })
            .eq('user_id', data.user.id)
            .select('*');

        console.log(users, administrator);
        if (!users?.length || userError) {
            // We silently fail here as the user is created but the role is not updated
            return null;
        }

        return users.at(0);
    },
    async salesUpdate(
        id: Identifier,
        data: Partial<Omit<SalesFormData, 'password'>>
    ) {
        const { data: sale } = await baseDataProvider.getOne<Sale>('sales', {
            id,
        });

        if (!sale) {
            return null;
        }

        const { email, first_name, last_name, administrator } = data;

        const updatedUser = await supabase.auth.admin.updateUserById(
            sale.user_id,
            {
                email,
                user_metadata: {
                    first_name,
                    last_name,
                },
            }
        );

        if (updatedUser.error) {
            console.error('salesUpdate.error', updatedUser.error);
            throw new Error('Failed to update sale');
        }

        return await baseDataProvider.update('sales', {
            id,
            data: {
                first_name,
                last_name,
                administrator,
            },
            previousData: sale,
        });
    },
    async transferAdministratorRole(from: Identifier, to: Identifier) {
        const { data: sales } = await baseDataProvider.getList('sales', {
            filter: { id: [from, to] },
            pagination: { page: 1, perPage: 2 },
            sort: { field: 'name', order: 'ASC' },
        });

        const fromSale = sales.find(sale => sale.id === from);
        const toSale = sales.find(sale => sale.id === to);

        if (!fromSale || !toSale) {
            return null;
        }

        await baseDataProvider.update('sales', {
            id: to,
            data: {
                administrator: true,
            },
            previousData: toSale,
        });

        const updatedUser = await baseDataProvider.update('sales', {
            id: from,
            data: {
                administrator: false,
            },
            previousData: fromSale,
        });
        return updatedUser.data;
    },
    async unarchiveDeal(deal: Deal) {
        // get all deals where stage is the same as the deal to unarchive
        const { data: deals } = await baseDataProvider.getList<Deal>('deals', {
            filter: { stage: deal.stage },
            pagination: { page: 1, perPage: 1000 },
            sort: { field: 'index', order: 'ASC' },
        });

        // set index for each deal starting from 1, if the deal to unarchive is found, set its index to the last one
        const updatedDeals = deals.map((d, index) => ({
            ...d,
            index: d.id === deal.id ? 0 : index + 1,
            archived_at: d.id === deal.id ? null : d.archived_at,
        }));

        return await Promise.all(
            updatedDeals.map(updatedDeal =>
                baseDataProvider.update('deals', {
                    id: updatedDeal.id,
                    data: updatedDeal,
                    previousData: deals.find(d => d.id === updatedDeal.id),
                })
            )
        );
    },
    async getActivityLog(companyId?: Identifier) {
        return getActivityLog(baseDataProvider, companyId);
    },
    async isInitialized() {
        const { data } = await supabase
            .from('init_state')
            .select('is_initialized');

        return data?.at(0)?.is_initialized > 0;
    },
} satisfies DataProvider;

export type CustomDataProvider = typeof dataProviderWithCustomMethods;

export const dataProvider = withLifecycleCallbacks(
    dataProviderWithCustomMethods,
    [
        {
            resource: 'contacts',
            beforeGetList: async params => {
                return applyFullTextSearch([
                    'first_name',
                    'last_name',
                    'title',
                    'email',
                    'phone_number1',
                    'phone_number2',
                    'background',
                ])(params);
            },
        },
        {
            resource: 'companies',
            beforeGetList: async params => {
                return applyFullTextSearch([
                    'name',
                    'phone_number',
                    'website',
                    'zipcode',
                    'city',
                    'stateAbbr',
                ])(params);
            },
        },
        {
            resource: 'deals',
            beforeGetList: async params => {
                return applyFullTextSearch(['name', 'type', 'description'])(
                    params
                );
            },
        },
    ]
);

const applyFullTextSearch = (columns: string[]) => (params: GetListParams) => {
    if (!params.filter?.q) {
        return params;
    }
    const { q, ...filter } = params.filter;
    return {
        ...params,
        filter: {
            ...filter,
            '@or': columns.reduce(
                (acc, column) => ({
                    ...acc,
                    [`${column}@fts`]: q,
                }),
                {}
            ),
        },
    };
};

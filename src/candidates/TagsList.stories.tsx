import type { Meta, StoryObj } from '@storybook/react';
import { DataProviderContext, RecordContextProvider } from 'react-admin';
import { MemoryRouter } from 'react-router-dom';
import fakerestDataProvider from 'ra-data-fakerest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { random } from 'faker/locale/en_US';

import { TagsList } from './TagsList';
import { generateTags } from '../providers/fakerest/dataGenerator/tags';
import { generateCompanies } from '../providers/fakerest/dataGenerator/companies';
import { generateCandidates } from '../providers/fakerest/dataGenerator/candidates';
import { Db } from '../providers/fakerest/dataGenerator/types';

const db = {} as Db;
db.tags = generateTags(db);
db.companies = generateCompanies(db, 1);
db.candidates = generateCandidates(db, 1);
db.candidates[0].tags = random.arrayElements(db.tags, 3).map(tag => tag.id);

const meta: Meta<typeof TagsList> = {
    component: TagsList,
    decorators: [
        Story => {
            return (
                <MemoryRouter>
                    <QueryClientProvider client={new QueryClient()}>
                        <DataProviderContext.Provider
                            value={fakerestDataProvider(db)}
                        >
                            <RecordContextProvider value={db.candidates[0]}>
                                <Story />
                            </RecordContextProvider>
                        </DataProviderContext.Provider>
                    </QueryClientProvider>
                </MemoryRouter>
            );
        },
    ],
};

export default meta;
type Story = StoryObj<typeof TagsList>;

export const Basic: Story = {
    args: {},
};

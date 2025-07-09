import type { Meta, StoryObj } from '@storybook/react';
import { ListContextProvider, useList } from 'react-admin';
import { MemoryRouter } from 'react-router-dom';

import { ContactList } from './ContactList';
import { generateCompanies } from '../providers/fakerest/dataGenerator/companies';
import { generateContacts } from '../providers/fakerest/dataGenerator/contacts';
import { Db } from '../providers/fakerest/dataGenerator/types';

const db = {} as Db;
db.companies = generateCompanies(db, 3);
db.contacts = generateContacts(db, 5);

const meta: Meta<typeof ContactList> = {
    component: ContactList,
    decorators: [
        Story => {
            const listContext = useList({
                resource: 'contacts',
                data: db.contacts,
            });
            return (
                <MemoryRouter>
                    <ListContextProvider value={listContext}>
                        <Story />
                    </ListContextProvider>
                </MemoryRouter>
            );
        },
    ],
};

export default meta;
type Story = StoryObj<typeof ContactList>;

export const Basic: Story = {
    args: {},
};

/* eslint-disable import/no-anonymous-default-export */
import { Card, Stack } from '@mui/material';
import jsonExport from 'jsonexport/dist';
import type { Exporter } from 'react-admin';
import {
    BulkActionsToolbar,
    BulkDeleteButton,
    BulkExportButton,
    CreateButton,
    downloadCSV,
    ExportButton,
    ListBase,
    ListToolbar,
    Pagination,
    SortButton,
    Title,
    TopToolbar,
    useGetIdentity,
    useListContext,
} from 'react-admin';

import { Company, Contact, Sale, Tag } from '../types';
import { ContactEmpty } from './ContactEmpty';
import { ContactImportButton } from './ContactImportButton';
import { ContactListContent } from './ContactListContent';
import { ContactListFilter } from './ContactListFilter';

export const ContactList = () => {
    const { identity } = useGetIdentity();

    if (!identity) return null;

    return (
        <ListBase
            perPage={25}
            sort={{ field: 'last_seen', order: 'DESC' }}
            exporter={exporter}
        >
            <ContactListLayout />
        </ListBase>
    );
};

const ContactListLayout = () => {
    const { data, isPending, filterValues } = useListContext();
    const { identity } = useGetIdentity();

    const hasFilters = filterValues && Object.keys(filterValues).length > 0;

    if (!identity || isPending) return null;

    if (!data?.length && !hasFilters) return <ContactEmpty />;

    return (
        <Stack direction="row">
            <ContactListFilter />
            <Stack sx={{ width: '100%' }}>
                <Title title={'Contacts'} />
                <ListToolbar actions={<ContactListActions />} />
                <BulkActionsToolbar>
                    <BulkExportButton />
                    <BulkDeleteButton />
                </BulkActionsToolbar>
                <Card>
                    <ContactListContent />
                </Card>
                <Pagination rowsPerPageOptions={[10, 25, 50, 100]} />
            </Stack>
        </Stack>
    );
};

const ContactListActions = () => (
    <TopToolbar>
        <SortButton fields={['last_name', 'first_name', 'last_seen']} />
        <ContactImportButton />
        <ExportButton />
        <CreateButton
            variant="contained"
            label="New Contact"
            sx={{ marginLeft: 2 }}
        />
    </TopToolbar>
);

const exporter: Exporter<Contact> = async (records, fetchRelatedRecords) => {
    const companies = await fetchRelatedRecords<Company>(
        records,
        'company_id',
        'companies'
    );
    const sales = await fetchRelatedRecords<Sale>(records, 'sales_id', 'sales');
    const tags = await fetchRelatedRecords<Tag>(records, 'tags', 'tags');

    const contacts = records.map(contact => {
        const exportedContact = {
            ...contact,
            company:
                contact.company_id != null
                    ? companies[contact.company_id].name
                    : undefined,
            sales: `${sales[contact.sales_id].first_name} ${
                sales[contact.sales_id].last_name
            }`,
            tags: contact.tags.map(tagId => tags[tagId].name).join(', '),
            email_work: contact.email_jsonb?.find(
                email => email.type === 'Work'
            )?.email,
            email_home: contact.email_jsonb?.find(
                email => email.type === 'Home'
            )?.email,
            email_other: contact.email_jsonb?.find(
                email => email.type === 'Other'
            )?.email,
            email_jsonb: JSON.stringify(contact.email_jsonb),
            email_fts: undefined,
            phone_work: contact.phone_jsonb?.find(
                phone => phone.type === 'Work'
            )?.number,
            phone_home: contact.phone_jsonb?.find(
                phone => phone.type === 'Home'
            )?.number,
            phone_other: contact.phone_jsonb?.find(
                phone => phone.type === 'Other'
            )?.number,
            phone_jsonb: JSON.stringify(contact.phone_jsonb),
            phone_fts: undefined,
        };
        delete exportedContact.email_fts;
        delete exportedContact.phone_fts;
        return exportedContact;
    });
    return jsonExport(contacts, {}, (_err: any, csv: string) => {
        downloadCSV(csv, 'contacts');
    });
};

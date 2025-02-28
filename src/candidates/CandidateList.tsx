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

import { Company, Candidate, Sale, Tag } from '../types';
import { CandidateEmpty } from './CandidateEmpty';
import { CandidateImportButton } from './CandidateImportButton';
import { CandidateListContent } from './CandidateListContent';
import { CandidateListFilter } from './CandidateListFilter';

export const CandidateList = () => {
    const { identity } = useGetIdentity();

    if (!identity) return null;

    return (
        <ListBase
            perPage={25}
            sort={{ field: 'last_seen', order: 'DESC' }}
            exporter={exporter}
        >
            <CandidateListLayout />
        </ListBase>
    );
};

const CandidateListLayout = () => {
    const { data, isPending, filterValues } = useListContext();
    const { identity } = useGetIdentity();

    const hasFilters = filterValues && Object.keys(filterValues).length > 0;

    if (!identity || isPending) return null;

    if (!data?.length && !hasFilters) return <CandidateEmpty />;

    return (
        <Stack direction="row">
            <CandidateListFilter />
            <Stack sx={{ width: '100%' }}>
                <Title title={'Candidates'} />
                <ListToolbar actions={<CandidateListActions />} />
                <BulkActionsToolbar>
                    <BulkExportButton />
                    <BulkDeleteButton />
                </BulkActionsToolbar>
                <Card>
                    <CandidateListContent />
                </Card>
                <Pagination rowsPerPageOptions={[10, 25, 50, 100]} />
            </Stack>
        </Stack>
    );
};

const CandidateListActions = () => (
    <TopToolbar>
        <SortButton fields={['last_name', 'first_name', 'last_seen']} />
        <CandidateImportButton />
        <ExportButton />
        <CreateButton
            variant="contained"
            label="New Candidate"
            sx={{ marginLeft: 2 }}
        />
    </TopToolbar>
);

const exporter: Exporter<Candidate> = async (records, fetchRelatedRecords) => {
    const companies = await fetchRelatedRecords<Company>(
        records,
        'company_id',
        'companies'
    );
    const sales = await fetchRelatedRecords<Sale>(records, 'sales_id', 'sales');
    const tags = await fetchRelatedRecords<Tag>(records, 'tags', 'tags');

    const candidates = records.map(candidate => {
        const exportedCandidate = {
            ...candidate,
            company:
                candidate.company_id != null
                    ? companies[candidate.company_id].name
                    : undefined,
            sales: `${sales[candidate.sales_id].first_name} ${
                sales[candidate.sales_id].last_name
            }`,
            tags: candidate.tags.map(tagId => tags[tagId].name).join(', '),
            email_work: candidate.email_jsonb?.find(
                email => email.type === 'Work'
            )?.email,
            email_home: candidate.email_jsonb?.find(
                email => email.type === 'Home'
            )?.email,
            email_other: candidate.email_jsonb?.find(
                email => email.type === 'Other'
            )?.email,
            email_jsonb: JSON.stringify(candidate.email_jsonb),
            email_fts: undefined,
            phone_work: candidate.phone_jsonb?.find(
                phone => phone.type === 'Work'
            )?.number,
            phone_home: candidate.phone_jsonb?.find(
                phone => phone.type === 'Home'
            )?.number,
            phone_other: candidate.phone_jsonb?.find(
                phone => phone.type === 'Other'
            )?.number,
            phone_jsonb: JSON.stringify(candidate.phone_jsonb),
            phone_fts: undefined,
        };
        delete exportedCandidate.email_fts;
        delete exportedCandidate.phone_fts;
        return exportedCandidate;
    });
    return jsonExport(candidates, {}, (_err: any, csv: string) => {
        downloadCSV(csv, 'candidates');
    });
};

import {
    CreateButton,
    ExportButton,
    FilterButton,
    ListBase,
    ListToolbar,
    ReferenceInput,
    SearchInput,
    SelectInput,
    Title,
    TopToolbar,
    useGetIdentity,
    useListContext,
} from 'react-admin';
import { matchPath, useLocation } from 'react-router';

import { Card, Stack } from '@mui/material';
import { useConfigurationContext } from '../root/ConfigurationContext';
import { EngagementArchivedList } from './EngagementArchivedList';
import { EngagementCreate } from './EngagementCreate';
import { EngagementEdit } from './EngagementEdit';
import { EngagementEmpty } from './EngagementEmpty';
import { EngagementListContent } from './EngagementListContent';
import { EngagementShow } from './EngagementShow';
import { OnlyMineInput } from './OnlyMineInput';

const EngagementList = () => {
    const { identity } = useGetIdentity();

    if (!identity) return null;
    return (
        <ListBase
            perPage={100}
            filter={{
                'archived_at@is': null,
            }}
            sort={{ field: 'index', order: 'DESC' }}
        >
            <EngagementLayout />
        </ListBase>
    );
};

const EngagementLayout = () => {
    const location = useLocation();
    const matchCreate = matchPath('/engagements/create', location.pathname);
    const matchShow = matchPath('/engagements/:id/show', location.pathname);
    const matchEdit = matchPath('/engagements/:id', location.pathname);

    const { engagementCategories } = useConfigurationContext();

    const engagementFilters = [
        <SearchInput source="q" alwaysOn />,
        <ReferenceInput source="company_id" reference="companies" />,
        <SelectInput
            source="category"
            label="Category"
            choices={engagementCategories.map(type => ({ id: type, name: type }))}
        />,
        <OnlyMineInput source="sales_id" alwaysOn />,
    ];

    const { data, isPending, filterValues } = useListContext();
    const hasFilters = filterValues && Object.keys(filterValues).length > 0;

    if (isPending) return null;
    if (!data?.length && !hasFilters)
        return (
            <>
                <EngagementEmpty>
                    <EngagementShow open={!!matchShow} id={matchShow?.params.id} />
                    <EngagementArchivedList />
                </EngagementEmpty>
            </>
        );

    return (
        <Stack component="div" sx={{ width: '100%' }}>
            <Title title={'Engagements'} />
            <ListToolbar filters={engagementFilters} actions={<EngagementActions />} />
            <Card>
                <EngagementListContent />
            </Card>
            <EngagementArchivedList />
            <EngagementCreate open={!!matchCreate} />
            <EngagementEdit
                open={!!matchEdit && !matchCreate}
                id={matchEdit?.params.id}
            />
            <EngagementShow open={!!matchShow} id={matchShow?.params.id} />
        </Stack>
    );
};

const EngagementActions = () => {
    return (
        <TopToolbar>
            <FilterButton />
            <ExportButton />
            <CreateButton
                variant="contained"
                label="New Engagement"
                sx={{ marginLeft: 2 }}
            />
        </TopToolbar>
    );
};

export default EngagementList;

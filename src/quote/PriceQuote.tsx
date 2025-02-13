import { useEffect } from 'react';

import {
    List,
    Datagrid,
    TextField,
    TextFieldProps,
    useRecordContext,
    ListProps,
    BooleanField,
    useUnselectAll,
    useStore,
    useGetList,
    TextInput,
    useListFilterContext,
    Form,
} from 'react-admin';

import { useForm, FormProvider, useFormContext } from 'react-hook-form';

import omit from 'lodash/omit';

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningIcon from '@mui/icons-material/Warning';
import ReportIcon from '@mui/icons-material/Report';

import { GroupByFilter } from '../GroupByFilter';
import { Box } from '@mui/material';

import { Tooltip, Typography, Stack } from '@mui/material';

import { CurrencyField } from '../CurrencyField';

const ValueField = (props: TextFieldProps) => {
    const record = useRecordContext();
    if (!record) return null;

    if (record.price_type === 'PERCENT')
        if ((record[props.source] ?? null) !== null)
            return `${record[props.source]}%`;
        else return null;

    return <CurrencyField source={props.source} />;
};

const LastUpdated = (_props: TextFieldProps) => {
    const record = useRecordContext();
    if (!record) return null;
    let validation_date = record.validation_date;

    if (!validation_date) return null;

    validation_date = validation_date.replace('T', ' ').replace(/\.\d+$/, 'Z');

    const dt = new Date(validation_date);
    const age_hh = (Date.now() - dt.getTime()) / 1000 / 60 / 60;

    if (age_hh < 12) {
        return (
            <Tooltip
                title={
                    <span style={{ fontSize: '14px' }}>
                        <div>Last updated within last 12 hours</div>
                        <div>Last update: {dt.toLocaleString()}</div>
                    </span>
                }
            >
                <Typography component="span" variant="body2">
                    <CheckCircleOutlineIcon
                        style={{
                            color: 'green',
                            display: 'inline-flex',
                            verticalAlign: 'middle',
                            lineHeight: 0,
                        }}
                        fontSize="small"
                    />
                </Typography>
            </Tooltip>
        );
    } else if (age_hh < 24) {
        return (
            <Tooltip
                title={
                    <span style={{ fontSize: '14px' }}>
                        <div>Last updated more than 12 hours ago</div>
                        <div>Last update: {dt.toLocaleString()}</div>
                    </span>
                }
            >
                <Typography component="span" variant="body2">
                    <WarningIcon
                        style={{
                            color: 'orange',
                            display: 'inline-flex',
                            verticalAlign: 'middle',
                            lineHeight: 0,
                        }}
                        fontSize="small"
                    />
                </Typography>
            </Tooltip>
        );
    }

    return (
        <Tooltip
            title={
                <span style={{ fontSize: '14px' }}>
                    <div>Last updated more than 24 hours ago</div>
                    <div>Last update: {dt.toLocaleString()}</div>
                </span>
            }
        >
            <Typography component="span" variant="body2">
                <ReportIcon
                    style={{
                        color: 'red',
                        display: 'inline-flex',
                        verticalAlign: 'middle',
                        lineHeight: 0,
                    }}
                    fontSize="small"
                />
            </Typography>
        </Tooltip>
    );
};

const QuoteView = () => {
    const { filterValues } = useListFilterContext();

    const allFilters = { ...filter, ...filterValues };

    // const commodities = useGetList('location_prices', {
    //     filter: omit(allFilters, [
    //         'material_id',
    //         'material_name',
    //         'commodity_id',
    //         'commodity_name',
    //     ]),
    //     pagination: { page: 1, perPage: 1000 },
    //     meta: {
    //         columns: [
    //             'material_id',
    //             'material_name',
    //             'commodity_id',
    //             'commodity_name',
    //             `_row_count:material_id.count()`,
    //         ],
    //     },
    // });

    // const locations = useGetList('location_prices', {
    //     filter: omit(allFilters, [
    //         'company_id',
    //         'company_name',
    //         'location_id',
    //         'location_name',
    //     ]),
    //     pagination: { page: 1, perPage: 1000 },
    //     meta: {
    //         columns: [
    //             'company_id',
    //             'company_name',
    //             'location_id',
    //             'location_name',
    //             `_row_count:company_id.count()`,
    //         ],
    //     },
    // });

    const markets = useGetList('location_prices', {
        filter: omit(allFilters, ['market_type']),
        pagination: { page: 1, perPage: 1000 },
        sort: { field: 'market_type', order: 'ASC' },
        meta: {
            columns: ['market_type', `_row_count:id.count()`],
        },
    });

    return (
        <>
            <Form>
                <MarketForm markets={markets.data} />
            </Form>
            <Datagrid>
                <TextField source="company_name" />
                <TextField source="location_name" />
                <BooleanField
                    source="location_is_active"
                    label="Active Location?"
                    sx={{
                        '& .RaBooleanField-falseIcon': { color: 'red' },
                    }}
                />
                <TextField source="material_name" />
                <TextField source="commodity_name" />
                <TextField source="commodity_grade" />
                <TextField source="market_type" />
                <TextField source="price_type" />
                <ValueField source="price_value" label="Price" />
                <ValueField source="market_price_fix" label="Fixed Market" />
                <LastUpdated source="validation_date" label="Up to date?" />
                <BooleanField
                    source="active"
                    sx={{
                        '& .RaBooleanField-falseIcon': { color: 'red' },
                    }}
                />
            </Datagrid>{' '}
        </>
    );
};

const handleFilterFormSubmit = (event: any) => {
    event.preventDefault();
    return false;
};

const MarketForm = (props: {
    markets?: Array<{ id: string; market_type: string }>;
}) => {
    const formMethods = useFormContext();

    if (!props.markets) return null;

    const Markets = props.markets.map(v => {
        return (
            <TextInput
                label={v.market_type}
                source={v.market_type}
                key={v.market_type}
                sx={{ width: '120px', m: 1 }}
            />
        );
    });

    return (
        <form onSubmit={formMethods.handleSubmit(handleFilterFormSubmit)}>
            {Markets}
        </form>
    );
};

const QuoteList = (props: Omit<ListProps, 'children'>) => {
    const {
        sort = { field: 'id', order: 'ASC' },
        perPage = 25,
        ...rest
    } = props;

    return (
        <List
            perPage={perPage}
            sort={sort}
            {...rest}
            resource="location_prices"
            actions={false}
        >
            <Stack
                direction="row"
                justifyContent="flex-start"
                spacing={2}
                mt={1}
            >
                <Box sx={{ maxWidth: '350px', width: '350px' }}>
                    <GroupByFilter
                        source="material_name"
                        source_id="material_id"
                        label="material_name"
                        filter={props.filter}
                    />
                </Box>
                <Box sx={{ maxWidth: '350px', width: '350px' }}>
                    <GroupByFilter
                        source="company_name"
                        source_id="company_id"
                        label="company_name"
                        filter={props.filter}
                    />
                </Box>
            </Stack>
            <QuoteView />
        </List>
    );
};

const filter = {
    location_is_active: true,
    material_is_active: true,
    commodity_is_active: true,
    active: true,
    'validation_date_age@lte': 24,
};

export const Quote = () => {
    const pathname = 'quote';

    const [savedPath, setSavedPath] = useStore(
        'location_prices.selectedIds.pathname',
        '/quote'
    );

    const unselectAll = useUnselectAll('location_prices');

    useEffect(
        () => {
            if (savedPath !== pathname) {
                unselectAll();
            }
            setSavedPath(pathname);
        },

        [savedPath, pathname, setSavedPath, unselectAll] // make sure we unselect all when location or company changes or when table loads
    );

    // https://mui.com/material-ui/react-checkbox/#indeterminate

    return (
        <QuoteList
            resource="location_prices"
            disableSyncWithLocation={true}
            filter={filter}
            actions={false}
            storeKey={`location_prices:${pathname}`}
            empty={
                <div style={{ margin: '16px' }}>No validated pricess found</div>
            }
        />
    );
};

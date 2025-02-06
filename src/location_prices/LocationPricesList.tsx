import {
    List,
    Datagrid,
    TextField,
    TextFieldProps,
    useRecordContext,
    ListProps,
    BooleanField,
    TopToolbar,
    ExportButton,
    Button,
} from 'react-admin';

import { Link } from 'react-router-dom';
import AddCircle from '@mui/icons-material/AddCircleOutline';
import { Stack } from '@mui/material';

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

const Active = (props: TextFieldProps) => {
    const record = useRecordContext();
    if (!record) return null;

    if (record.location_is_active)
        return <BooleanField source={props.source} />;
    else return <BooleanField source={props.source} sx={{ color: 'red' }} />;
};

export const LocationPricesList = (props: Omit<ListProps, 'children'>) => {
    const {
        sort = { field: 'id', order: 'ASC' },
        perPage = 25,
        ...rest
    } = props;

    return (
        <List perPage={perPage} sort={sort} {...rest}>
            <Datagrid
                rowSx={record => {
                    if (record.location_is_active) return {};
                    else
                        return {
                            backgroundColor: 'yellow',
                        };
                }}
                sx={{ '& .MuiTableCell-root': { color: 'unset' } }}
            >
                <TextField source="company_name" />
                <TextField source="location_name" />
                <Active source="location_is_active" label="Active Location?" />
                <TextField source="material_name" />
                <TextField source="commodity_name" />
                <TextField source="commodity_grade" />
                <TextField source="market_type" />
                <TextField source="price_type" />
                <ValueField source="price_value" label="Price" />
                <ValueField source="market_price_fix" label="Fixed Market" />
            </Datagrid>
        </List>
    );
};

export const LocationTabPriceList = (props: {
    pathname: string;
    company_id: string | number;
    location_id?: string | number;
}) => {
    const { pathname, company_id, location_id } = props;

    const filter = { company_id, location_id };
    if (filter.location_id === undefined) delete filter.location_id;

    return (
        <LocationPricesList
            resource="location_prices"
            disableSyncWithLocation={true}
            filter={filter}
            actions={
                <TopToolbar>
                    <CreateRelatedLocation
                        pathname={pathname}
                        company_id={company_id}
                        location_id={location_id}
                    />
                    <ExportButton />
                </TopToolbar>
            }
            empty={
                <>
                    <Stack
                        direction="row"
                        justifyContent="flex-end"
                        spacing={2}
                        mt={1}
                    >
                        <CreateRelatedLocation
                            pathname={pathname}
                            company_id={company_id}
                            location_id={location_id}
                        />
                    </Stack>
                    <div>No records</div>
                </>
            }
        />
    );
};

const CreateRelatedLocation = (props: {
    pathname: string;
    company_id: string | number;
    location_id?: string | number;
}) => {
    const { pathname, company_id, location_id } = props;

    const state = pathname
        ? {
              from: pathname,
              redirect_on_save: pathname,
              record: { company_id: company_id, location_id },
          }
        : undefined;

    return (
        <Button
            component={Link}
            to="/location_prices/create"
            state={state}
            label="Add Sales Price"
        >
            <AddCircle />
        </Button>
    );
};

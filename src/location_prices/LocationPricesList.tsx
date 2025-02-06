import {
    List,
    Datagrid,
    TextField,
    TextFieldProps,
    useRecordContext,
    ListProps,
    BooleanField,
} from 'react-admin';

import { CurrencyField } from '../CurrencyField';

const ValueField = (props: TextFieldProps) => {
    const record = useRecordContext();
    if (!record) return null;

    console.log({ zzz: record[props.source] });
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

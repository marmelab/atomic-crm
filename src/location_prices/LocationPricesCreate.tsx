import {
    CreateBase,
    Form,
    Toolbar,
    useGetIdentity,
    ReferenceInput,
    AutocompleteInput,
    TextInput,
    NumberInput,
    required,
} from 'react-admin';
import { Card, CardContent, Box, Stack, Divider } from '@mui/material';

import { useLocation } from 'react-router-dom';

const price_types: Array<T['price_type']> = ['FIXED', 'DISCOUNT', 'PERCENT'];
const market_types: Array<T['market_type']> = ['LME', 'CMX', 'LLME', 'NONE'];

type T = {
    market_price_fix?: number;
    market_type: 'LME' | 'CMX' | 'LLME' | 'NONE';
    price_type: 'FIXED' | 'DISCOUNT' | 'PERCENT';
    price_value: number;
    [x: string]: any;
};

// sort prices_types
const price_type_choices = price_types.sort().map(v => ({ id: v, name: v }));
const market_types_choices = market_types.sort().map(v => ({ id: v, name: v }));

const validate_market_fix = (value: any, values: T) => {
    if (!value) return;
    if (values.market_type === 'NONE')
        return `Market type must be on of the following values: ${market_types.filter(v => v !== 'NONE').join(',')}`;
};

const validate_price_type = (_value: any, values: T) => {
    const value = values['price_type'];

    if (value === 'DISCOUNT' || value === 'PERCENT') {
        if (values.market_type !== 'NONE') return;
        else
            return `Market type must be on of the following values when price type is '${value}': ${market_types.filter(v => v !== 'NONE').join(', ')}`;
    } else return;
};

const validate_price_value = (_value: any, values: T) => {
    const price_type = values.price_type;
    const price_value = values.price_value;

    if (price_value > 0 && price_type === 'DISCOUNT')
        return `Value must be negative or 0 when 'DISCOUNT' price type is used`;
    if ((price_value < 0 || price_value > 100) && price_type === 'PERCENT')
        return `Value must be between 0 and 100 when 'PERCENT' price type is used is used`;
};

export const LocationPricesCreate = () => {
    const { identity } = useGetIdentity();

    const l = useLocation();

    const { company_id, location_id } = l.state?.record ?? {};
    const { redirect_on_save } = l.state ?? {};

    const companyFilter = { id: company_id };
    if (companyFilter.id === undefined) delete companyFilter.id;

    const locationFilters = {
        company_id: company_id,
        id: location_id,
        // do not include filter if location is defined
        active: location_id === undefined ? true : undefined,
    };

    if (locationFilters.company_id === undefined)
        delete locationFilters.company_id;
    if (locationFilters.id === undefined) delete locationFilters.id;
    if (locationFilters.active === undefined) delete locationFilters.active;

    const redirect = redirect_on_save ?? 'list';

    console.log({ locationFilters, companyFilter });

    return (
        <CreateBase
            redirect={redirect}
            transform={(data: any) => {
                const ret = { ...data };
                if ((ret.commodity_grade ?? null) === null)
                    ret.commodity_grade = '';
                ret.sales_id = identity?.id;
                ret.validation_date = new Date().toISOString();
                if (!ret.market_price_fix) ret.market_price_fix = null;
                delete ret.company_id;
                if (ret.location_id === undefined && location_id !== undefined)
                    ret.location_id = location_id;
                return ret;
            }}
        >
            <Box mt={2} display="flex">
                <Box flex="1">
                    <Form
                        defaultValues={{
                            sales_id: identity?.id,
                            validation_date: new Date().toISOString(),
                            company_id,
                            location_id,
                        }}
                    >
                        <Card>
                            <CardContent>
                                <Stack gap={4} direction="row">
                                    <ReferenceInput
                                        source="company_id"
                                        reference="companies"
                                        filter={companyFilter}
                                    >
                                        <AutocompleteInput
                                            optionText="name"
                                            helperText={false}
                                            disabled
                                        />
                                    </ReferenceInput>

                                    <ReferenceInput
                                        source="location_id"
                                        reference="locations"
                                        filter={locationFilters}
                                    >
                                        <AutocompleteInput
                                            optionText={v => {
                                                if (v.active === true)
                                                    return v.name;
                                                return `${v.name} (archived)`;
                                            }}
                                            helperText={false}
                                            validate={
                                                location_id === undefined
                                                    ? required()
                                                    : undefined
                                            }
                                            disabled={location_id !== undefined}
                                        />
                                    </ReferenceInput>
                                </Stack>

                                <Divider sx={{ marginBottom: '8px' }} />

                                <Stack gap={4} direction="row">
                                    <ReferenceInput
                                        source="commodity_id"
                                        reference="commodities"
                                        filter={{
                                            active: true,
                                        }}
                                    >
                                        <AutocompleteInput
                                            optionText={v => {
                                                return `${v.material_name} | ${v.name}`;
                                            }}
                                            helperText={false}
                                            validate={required()}
                                        />
                                    </ReferenceInput>

                                    <TextInput source="commodity_grade" />
                                </Stack>

                                <Stack gap={4} direction="row">
                                    <AutocompleteInput
                                        source="market_type"
                                        choices={market_types_choices}
                                        validate={required()}
                                    />
                                    <AutocompleteInput
                                        source="price_type"
                                        choices={price_type_choices}
                                        validate={[
                                            required(),
                                            validate_price_type,
                                        ]}
                                    />
                                    <NumberInput
                                        source="price_value"
                                        validate={[
                                            required(),
                                            validate_price_value,
                                        ]}
                                    />

                                    <NumberInput
                                        source="market_price_fix"
                                        validate={validate_market_fix}
                                    />
                                </Stack>
                            </CardContent>
                            <Toolbar />
                        </Card>
                    </Form>
                </Box>
            </Box>
        </CreateBase>
    );
};

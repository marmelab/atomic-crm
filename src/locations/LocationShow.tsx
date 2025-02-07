import {
    Box,
    Card,
    CardContent,
    Typography,
    useTheme,
    useMediaQuery,
} from '@mui/material';

import { useState } from 'react';

import {
    ReferenceField,
    ShowBase,
    TabbedShowLayout,
    useShowContext,
    Edit,
    Form,
    Toolbar,
    TextInput,
    NumberInput,
    SaveButton,
    BooleanInput,
} from 'react-admin';

import { LocationAside } from './LocationShow_Aside';
import { LocationTabPriceList } from '../location_prices';

import { Location } from '../types';

import { useLocation } from 'react-router-dom';

export const LocationShow = () => (
    <ShowBase>
        <LocationShowContent />
    </ShowBase>
);

const helperTextPort = (
    <>
        <span style={{ display: 'block' }}>
            Fee ($ per load) charged by the port and/or customs.
        </span>
        <span>Up to 2 decimal values are allowed.</span>
    </>
);

const LocationShowContent = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const { record, isPending } = useShowContext<Location>();
    const location = useLocation();

    const [loc_state] = useState(location.state || undefined);

    const redirect = loc_state?.redirect_on_save || 'list';

    if (isPending || !record) return null;

    return (
        <Box mt={2} display="flex" flexDirection={isMobile ? 'column' : 'row'}>
            <Box flex="1">
                <Card>
                    <CardContent>
                        <Box display="flex" mb={1}>
                            <Typography variant="h5" ml={2} flex="1">
                                {record.name}
                            </Typography>
                        </Box>

                        <TabbedShowLayout
                            sx={{
                                '& .RaTabbedShowLayout-content': { p: 0 },
                            }}
                        >
                            <TabbedShowLayout.Tab label="Location Info">
                                <Box mt={2}>
                                    <Edit
                                        actions={false}
                                        redirect={redirect}
                                        transform={values_params => {
                                            const values = { ...values_params };
                                            // add https:// before website if not present
                                            if (
                                                values.website &&
                                                !values.website.startsWith(
                                                    'http'
                                                )
                                            ) {
                                                values.website = `https://${values.website}`;
                                            }
                                            return values;
                                        }}
                                        mutationMode="pessimistic"
                                    >
                                        <Form>
                                            <CardContent>
                                                <TextInput
                                                    source="id"
                                                    disabled
                                                />
                                                <TextInput source="name" />
                                                <NumberInput
                                                    source="port_fee"
                                                    min={0}
                                                    helperText={helperTextPort}
                                                />
                                                <TextInput
                                                    source="shipping_address"
                                                    multiline
                                                    minRows={5}
                                                    maxRows={15}
                                                />
                                                <TextInput
                                                    source="notes"
                                                    multiline
                                                    minRows={5}
                                                    maxRows={15}
                                                />

                                                <BooleanInput source="active" />
                                            </CardContent>
                                            <Toolbar>
                                                <SaveButton />
                                            </Toolbar>
                                        </Form>
                                    </Edit>
                                </Box>
                            </TabbedShowLayout.Tab>

                            <TabbedShowLayout.Tab
                                label="Sale Prices"
                                path="sale_prices"
                            >
                                <LocationTabPriceList
                                    location_id={record.id}
                                    company_id={record.company_id}
                                    pathname={location.pathname}
                                />
                            </TabbedShowLayout.Tab>
                        </TabbedShowLayout>
                    </CardContent>
                </Card>
            </Box>
            <ReferenceField
                reference="companies"
                source="company_id"
                link={false}
                sx={isMobile ? { pt: 3 } : undefined}
            >
                <LocationAside />
            </ReferenceField>
        </Box>
    );
};

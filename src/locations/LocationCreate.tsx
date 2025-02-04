import {
    CreateBase,
    Form,
    Toolbar,
    // useGetIdentity
} from 'react-admin';
import { Card, CardContent, Box } from '@mui/material';

import { LocationInputs } from './LocationInputs';

import { useLocation } from 'react-router-dom';

export const LocationCreate = () => {
    // const { identity } = useGetIdentity();

    const l = useLocation();

    const redirect =
        l.state && l.state.record?.company_id
            ? () => {
                  return `companies/${l.state.record.company_id}/show/locations`;
              }
            : 'show';

    return (
        <CreateBase redirect={redirect}>
            <Box mt={2} display="flex">
                <Box flex="1">
                    <Form
                    // defaultValues={{ sales_id: identity?.id }}
                    >
                        <Card>
                            <CardContent>
                                <LocationInputs />
                            </CardContent>
                            <Toolbar />
                        </Card>
                    </Form>
                </Box>
            </Box>
        </CreateBase>
    );
};

import { useRecordContext, Link } from 'react-admin';
import { Company } from '../types';
import { Stack, Typography } from '@mui/material';

import {
    AddressInfo,
    CompanyInfo,
    ContextInfo,
} from '../companies/CompanyAside';

export const LocationAside = () => {
    const record = useRecordContext<Company>();
    if (!record) return null;

    return (
        <Stack ml={4} width={300} minWidth={300} spacing={2}>
            <Typography variant="h6">
                <Link to={`/companies/${record.id}/show`} underline="none">
                    {record.name}
                </Link>
            </Typography>
            <CompanyInfo record={record} />

            <AddressInfo record={record} />

            <ContextInfo record={record} />
        </Stack>
    );
};

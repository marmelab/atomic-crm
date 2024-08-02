import * as React from 'react';
import { useState } from 'react';
import { Paper, Typography, Box } from '@mui/material';
import ContactsIcon from '@mui/icons-material/AccountCircle';
import DealIcon from '@mui/icons-material/MonetizationOn';
import {
    useCreatePath,
    SelectField,
    useRecordContext,
    Link,
    ReferenceManyCount,
} from 'react-admin';

import { CompanyAvatar } from './CompanyAvatar';
import { Company } from '../types';
import { useConfigurationContext } from '../root/ConfigurationContext';

export const CompanyCard = (props: { record?: Company }) => {
    const { companySectors } = useConfigurationContext();
    const [elevation, setElevation] = useState(1);
    const createPath = useCreatePath();
    const record = useRecordContext<Company>(props);
    if (!record) return null;

    return (
        <Link
            to={createPath({
                resource: 'companies',
                id: record.id,
                type: 'show',
            })}
            underline="none"
            onMouseEnter={() => setElevation(3)}
            onMouseLeave={() => setElevation(1)}
        >
            <Paper
                sx={{
                    height: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1em',
                }}
                elevation={elevation}
            >
                <Box display="flex" flexDirection="column" alignItems="center">
                    <CompanyAvatar />
                    <Box textAlign="center" marginTop={1}>
                        <Typography variant="subtitle2">
                            {record.name}
                        </Typography>
                        <SelectField
                            color="textSecondary"
                            source="sector"
                            choices={companySectors.map(sector => ({
                                id: sector,
                                name: sector,
                            }))}
                        />
                    </Box>
                </Box>
                <Box display="flex" justifyContent="space-around" width="100%">
                    <Box display="flex" alignItems="center">
                        <ContactsIcon color="disabled" sx={{ mr: 1 }} />
                        <ReferenceManyCount
                            label="Nb contacts"
                            reference="contacts"
                            target="company_id"
                        />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <DealIcon color="disabled" sx={{ mr: 1 }} />
                        <ReferenceManyCount
                            label="Nb deals"
                            reference="deals"
                            target="company_id"
                        />
                    </Box>
                </Box>
            </Paper>
        </Link>
    );
};

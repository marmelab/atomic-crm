import { Grid, Stack } from '@mui/material';
import { DashboardActivityLog } from './DashboardActivityLog';
import { DealsChart } from './DealsChart';
import { HotContacts } from './HotContacts';
import { TasksList } from './TasksList';
import { Welcome } from './Welcome';
import { useGetList } from 'react-admin';
import { Contact } from '../types';

export const Dashboard = () => {
    const { total: totalDeal } = useGetList<Contact>('deals', {
        pagination: { page: 1, perPage: 1 },
    });

    return (
        <Grid container spacing={2} mt={1} rowGap={4}>
            <Grid item xs={12} md={3}>
                <Stack gap={4}>
                    {import.meta.env.VITE_IS_DEMO === 'true' ? (
                        <Welcome />
                    ) : null}
                    <HotContacts />
                </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
                <Stack gap={4}>
                    {totalDeal ? <DealsChart /> : null}
                    <DashboardActivityLog />
                </Stack>
            </Grid>

            <Grid item xs={12} md={3}>
                <TasksList />
            </Grid>
        </Grid>
    );
};

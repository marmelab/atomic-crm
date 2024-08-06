import * as React from 'react';
import { Card, Box, Stack } from '@mui/material';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { useGetList, Link, useGetIdentity } from 'react-admin';
import { Contact } from '../types';
import { AddTask } from '../tasks/AddTask';
import { startOfToday, endOfToday, addDays } from 'date-fns';
import { TasksListFilter } from './TasksListFilter';

const today = new Date();
const startOfTodayDateISO = startOfToday().toISOString();
const endOfTodayDateISO = endOfToday().toISOString();
const startOfWeekDateISO = addDays(today, 1).toISOString();
const endOfWeekDateISO = addDays(today, 7).toISOString();

const taskFilters = {
    overdue: { 'done_date@is': null, 'due_date@lt': startOfTodayDateISO },
    today: {
        'done_date@is': null,
        'due_date@gte': startOfTodayDateISO,
        'due_date@lte': endOfTodayDateISO,
    },
    tomorrow: {
        'done_date@is': null,
        'due_date@gt': endOfTodayDateISO,
        'due_date@lt': startOfWeekDateISO,
    },
    thisWeek: {
        'done_date@is': null,
        'due_date@gte': startOfWeekDateISO,
        'due_date@lte': endOfWeekDateISO,
    },
    later: { 'done_date@is': null, 'due_date@gt': endOfWeekDateISO },
};

export const TasksList = () => {
    const { identity } = useGetIdentity();
    const { data: contacts, isPending: contactsLoading } = useGetList<Contact>(
        'contacts',
        {
            pagination: { page: 1, perPage: 500 },
            filter: { sales_id: identity?.id },
        },
        { enabled: !!identity }
    );

    if (contactsLoading || !contacts) return null;

    return (
        <Stack>
            <Box display="flex" alignItems="center" mb={1}>
                <Box mr={1} display="flex">
                    <AssignmentTurnedInIcon
                        color="disabled"
                        fontSize="medium"
                    />
                </Box>
                <Link
                    underline="none"
                    variant="h5"
                    color="textSecondary"
                    to="/contacts"
                >
                    Upcoming Tasks
                </Link>
            </Box>
            <Card sx={{ px: 2 }}>
                <Box textAlign="center" mb={-2}>
                    <AddTask selectContact />
                </Box>
                <Stack mb={2}>
                    <TasksListFilter
                        title="Overdue"
                        filter={taskFilters.overdue}
                        contacts={contacts}
                    />
                    <TasksListFilter
                        title="Today"
                        filter={taskFilters.today}
                        contacts={contacts}
                    />
                    <TasksListFilter
                        title="Tomorrow"
                        filter={taskFilters.tomorrow}
                        contacts={contacts}
                    />
                    <TasksListFilter
                        title="This week"
                        filter={taskFilters.thisWeek}
                        contacts={contacts}
                    />
                    <TasksListFilter
                        title="Later"
                        filter={taskFilters.later}
                        contacts={contacts}
                    />
                </Stack>
            </Card>
        </Stack>
    );
};

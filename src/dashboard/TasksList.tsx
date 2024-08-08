import * as React from 'react';
import { Card, Box, Stack, Typography } from '@mui/material';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { AddTask } from '../tasks/AddTask';
import { startOfToday, endOfToday, addDays } from 'date-fns';
import { TasksListFilter } from './TasksListFilter';
import { TasksListEmpty } from './TasksListEmpty';

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
    return (
        <Stack>
            <Box display="flex" alignItems="center" mb={1}>
                <Box mr={1} display="flex">
                    <AssignmentTurnedInIcon
                        color="disabled"
                        fontSize="medium"
                    />
                </Box>
                <Typography variant="h5" color="textSecondary">
                    Upcoming Tasks
                </Typography>
                <AddTask display="icon" selectContact />
            </Box>
            <Card sx={{ p: 2 }}>
                <Stack>
                    <TasksListEmpty />
                    <TasksListFilter
                        title="Overdue"
                        filter={taskFilters.overdue}
                    />
                    <TasksListFilter title="Today" filter={taskFilters.today} />
                    <TasksListFilter
                        title="Tomorrow"
                        filter={taskFilters.tomorrow}
                    />
                    <TasksListFilter
                        title="This week"
                        filter={taskFilters.thisWeek}
                    />
                    <TasksListFilter title="Later" filter={taskFilters.later} />
                </Stack>
            </Card>
        </Stack>
    );
};

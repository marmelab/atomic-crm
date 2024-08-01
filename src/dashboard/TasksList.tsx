import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { Box, Button, Card } from '@mui/material';
import {
    Link,
    ListContextProvider,
    ResourceContextProvider,
    useGetIdentity,
    useGetList,
    useList,
} from 'react-admin';
import { TasksIterator } from '../tasks/TasksIterator';

import { Contact } from '../types';

export const TasksList = () => {
    const { identity } = useGetIdentity();

    // get all the contacts for this sales
    const { data: contacts, isPending: contactsLoading } = useGetList<Contact>(
        'contacts',
        {
            pagination: { page: 1, perPage: 500 },
            filter: { sales_id: identity?.id },
        },
        { enabled: !!identity }
    );

    // get the first 100 upcoming tasks for these contacts
    const { data: tasks, isPending: tasksLoading } = useGetList(
        'tasks',
        {
            pagination: { page: 1, perPage: 100 },
            sort: { field: 'due_date', order: 'ASC' },
            filter: contacts?.length
                ? {
                      'done_date@': 'is.null',
                      contact_id: contacts.map(contact => contact.id),
                  }
                : {
                      'done_date@': 'is.null',
                  },
        },
        { enabled: !!contacts }
    );

    const isPending = tasksLoading || contactsLoading;

    // limit to 10 tasks and provide the list context
    const listContext = useList({
        data: tasks,
        isPending,
        resource: 'tasks',
        perPage: 10,
    });
    return (
        <>
            <Box display="flex" alignItems="center" marginBottom="1em">
                <Box ml={2} mr={2} display="flex">
                    <AssignmentTurnedInIcon color="disabled" fontSize="large" />
                </Box>
                <Link
                    underline="none"
                    variant="h5"
                    color="textSecondary"
                    to="/contacts"
                >
                    Upcoming tasks
                </Link>
            </Box>
            <Card sx={{ px: 2, mb: '2em' }}>
                <ResourceContextProvider value="tasks">
                    <ListContextProvider value={listContext}>
                        <TasksIterator showContact />
                    </ListContextProvider>
                </ResourceContextProvider>
                {!isPending && (
                    <Button
                        onClick={() =>
                            listContext.setPerPage(listContext.perPage + 10)
                        }
                        fullWidth
                    >
                        Load more
                    </Button>
                )}
            </Card>
        </>
    );
};

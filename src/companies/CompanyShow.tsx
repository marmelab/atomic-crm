import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
    Box,
    Button,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemSecondaryAction,
    ListItemText,
    Stack,
    Typography,
} from '@mui/material';
import { formatDistance } from 'date-fns';
import {
    RecordContextProvider,
    ReferenceManyField,
    ShowBase,
    SortButton,
    TabbedShowLayout,
    useListContext,
    useRecordContext,
    useShowContext,
} from 'react-admin';
import { Link as RouterLink, useLocation } from 'react-router-dom';

import { ActivityLog } from '../activity/ActivityLog';
import { Avatar } from '../contacts/Avatar';
import { TagsList } from '../contacts/TagsList';
import { findEngagementLabel } from '../engagements/engagement';
import { Status } from '../misc/Status';
import { useConfigurationContext } from '../root/ConfigurationContext';
import { Company, Contact, Engagement } from '../types';
import { CompanyAside } from './CompanyAside';
import { CompanyAvatar } from './CompanyAvatar';

export const CompanyShow = () => (
    <ShowBase>
        <CompanyShowContent />
    </ShowBase>
);

const CompanyShowContent = () => {
    const { record, isPending } = useShowContext<Company>();

    if (isPending || !record) return null;

    return (
        <Box mt={2} display="flex">
            <Box flex="1">
                <Card>
                    <CardContent>
                        <Box display="flex" mb={1}>
                            <CompanyAvatar />
                            <Typography variant="h5" ml={2} flex="1">
                                {record.name}
                            </Typography>
                        </Box>

                        <TabbedShowLayout
                            sx={{
                                '& .RaTabbedShowLayout-content': { p: 0 },
                            }}
                        >
                            <TabbedShowLayout.Tab label="Activity">
                                <ActivityLog
                                    companyId={record.id}
                                    context="company"
                                />
                            </TabbedShowLayout.Tab>
                            <TabbedShowLayout.Tab
                                label={
                                    !record.nb_contacts
                                        ? 'No Contacts'
                                        : record.nb_contacts === 1
                                          ? '1 Contact'
                                          : `${record.nb_contacts} Contacts`
                                }
                                path="contacts"
                            >
                                <ReferenceManyField
                                    reference="contacts_summary"
                                    target="company_id"
                                    sort={{ field: 'last_name', order: 'ASC' }}
                                >
                                    <Stack
                                        direction="row"
                                        justifyContent="flex-end"
                                        spacing={2}
                                        mt={1}
                                    >
                                        {!!record.nb_contacts && (
                                            <SortButton
                                                fields={[
                                                    'last_name',
                                                    'first_name',
                                                    'last_seen',
                                                ]}
                                            />
                                        )}
                                        <CreateRelatedContactButton />
                                    </Stack>
                                    <ContactsIterator />
                                </ReferenceManyField>
                            </TabbedShowLayout.Tab>
                            {record.nb_engagements ? (
                                <TabbedShowLayout.Tab
                                    label={
                                        record.nb_engagements === 1
                                            ? '1 engagement'
                                            : `${record.nb_engagements} engagements`
                                    }
                                    path="engagements"
                                >
                                    <ReferenceManyField
                                        reference="engagements"
                                        target="company_id"
                                        sort={{ field: 'name', order: 'ASC' }}
                                    >
                                        <EngagementsIterator />
                                    </ReferenceManyField>
                                </TabbedShowLayout.Tab>
                            ) : null}
                        </TabbedShowLayout>
                    </CardContent>
                </Card>
            </Box>
            <CompanyAside />
        </Box>
    );
};

const ContactsIterator = () => {
    const location = useLocation();
    const { data: contacts, error, isPending } = useListContext<Contact>();

    if (isPending || error) return null;

    const now = Date.now();
    return (
        <List dense sx={{ pt: 0 }}>
            {contacts.map(contact => (
                <RecordContextProvider key={contact.id} value={contact}>
                    <ListItem disablePadding>
                        <ListItemButton
                            component={RouterLink}
                            to={`/contacts/${contact.id}/show`}
                            state={{ from: location.pathname }}
                        >
                            <ListItemAvatar>
                                <Avatar />
                            </ListItemAvatar>
                            <ListItemText
                                primary={`${contact.first_name} ${contact.last_name}`}
                                secondary={
                                    <>
                                        {contact.title}
                                        {contact.nb_tasks
                                            ? ` - ${contact.nb_tasks} task${
                                                  contact.nb_tasks > 1
                                                      ? 's'
                                                      : ''
                                              }`
                                            : ''}
                                        &nbsp; &nbsp;
                                        <TagsList />
                                    </>
                                }
                            />
                            {contact.last_seen && (
                                <ListItemSecondaryAction>
                                    <Typography
                                        variant="body2"
                                        color="textSecondary"
                                        component="span"
                                    >
                                        last activity{' '}
                                        {formatDistance(contact.last_seen, now)}{' '}
                                        ago <Status status={contact.status} />
                                    </Typography>
                                </ListItemSecondaryAction>
                            )}
                        </ListItemButton>
                    </ListItem>
                </RecordContextProvider>
            ))}
        </List>
    );
};

const CreateRelatedContactButton = () => {
    const company = useRecordContext<Company>();
    return (
        <Button
            component={RouterLink}
            to="/contacts/create"
            state={company ? { record: { company_id: company.id } } : undefined}
            color="primary"
            size="small"
            startIcon={<PersonAddIcon />}
        >
            Add contact
        </Button>
    );
};

const EngagementsIterator = () => {
    const { data: engagements, error, isPending } = useListContext<Engagement>();
    const { engagementStages } = useConfigurationContext();
    if (isPending || error) return null;

    const now = Date.now();
    return (
        <Box>
            <List dense>
                {engagements.map(engagement => (
                    <ListItem disablePadding key={engagement.id}>
                        <ListItemButton
                            component={RouterLink}
                            to={`/engagements/${engagement.id}/show`}
                        >
                            <ListItemText
                                primary={engagement.name}
                                secondary={
                                    <>
                                        {findEngagementLabel(engagementStages, engagement.stage)},{' '}
                                        {engagement.amount.toLocaleString('en-US', {
                                            notation: 'compact',
                                            style: 'currency',
                                            currency: 'USD',
                                            currencyDisplay: 'narrowSymbol',
                                            minimumSignificantDigits: 3,
                                        })}
                                        {engagement.category
                                            ? `, ${engagement.category}`
                                            : ''}
                                    </>
                                }
                            />
                            <ListItemSecondaryAction>
                                <Typography
                                    variant="body2"
                                    color="textSecondary"
                                    component="span"
                                >
                                    last activity{' '}
                                    {formatDistance(engagement.updated_at, now)} ago{' '}
                                </Typography>
                            </ListItemSecondaryAction>
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
};

import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogContent,
    Divider,
    Stack,
    Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { format, isValid } from 'date-fns';
import {
    DeleteButton,
    EditButton,
    ReferenceArrayField,
    ReferenceField,
    ReferenceManyField,
    ShowBase,
    useDataProvider,
    useNotify,
    useRecordContext,
    useRedirect,
    useRefresh,
    useUpdate,
} from 'react-admin';

import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import { CompanyAvatar } from '../companies/CompanyAvatar';
import { DialogCloseButton } from '../misc/DialogCloseButton';
import { NotesIterator } from '../notes';
import { useConfigurationContext } from '../root/ConfigurationContext';
import { Engagement } from '../types';
import { ContactList } from './ContactList';
import { findEngagementLabel } from './engagement';

export const EngagementShow = ({ open, id }: { open: boolean; id?: string }) => {
    const redirect = useRedirect();
    const handleClose = () => {
        redirect('list', 'engagements');
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullWidth
            maxWidth="md"
            sx={{
                '& .MuiDialog-container': {
                    alignItems: 'flex-start',
                },
            }}
        >
            <DialogContent sx={{ padding: 0 }}>
                {!!id ? (
                    <ShowBase id={id}>
                        <EngagementShowContent handleClose={handleClose} />
                    </ShowBase>
                ) : null}
            </DialogContent>
        </Dialog>
    );
};

const CLOSE_TOP_WITH_ARCHIVED = 14;
const EngagementShowContent = ({ handleClose }: { handleClose: () => void }) => {
    const { engagementStages } = useConfigurationContext();
    const record = useRecordContext<Engagement>();
    if (!record) return null;

    return (
        <>
            <DialogCloseButton
                onClose={handleClose}
                top={record.archived_at ? CLOSE_TOP_WITH_ARCHIVED : 16}
                right={10}
                color={record.archived_at ? 'white' : undefined}
            />
            <Stack gap={1}>
                {record.archived_at ? <ArchivedTitle /> : null}
                <Box display="flex" p={2}>
                    <Box flex="1">
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            mb={4}
                        >
                            <Stack direction="row" alignItems="center" gap={2}>
                                <ReferenceField
                                    source="company_id"
                                    reference="companies"
                                    link="show"
                                    sx={{ '& a': { textDecoration: 'none' } }}
                                >
                                    <CompanyAvatar />
                                </ReferenceField>
                                <Typography variant="h5">
                                    {record.name}
                                </Typography>
                            </Stack>
                            <Stack
                                gap={1}
                                direction="row"
                                pr={record.archived_at ? 0 : 6}
                            >
                                {record.archived_at ? (
                                    <>
                                        <UnarchiveButton record={record} />
                                        <DeleteButton />
                                    </>
                                ) : (
                                    <>
                                        <ArchiveButton record={record} />
                                        <EditButton scrollToTop={false} />
                                    </>
                                )}
                            </Stack>
                        </Stack>

                        <Box display="flex" m={2}>
                            <Box display="flex" mr={5} flexDirection="column">
                                <Typography
                                    color="textSecondary"
                                    variant="caption"
                                >
                                    Expected closing date
                                </Typography>
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    gap={1}
                                >
                                    <Typography variant="body2">
                                        {isValid(
                                            new Date(
                                                record.expected_closing_date
                                            )
                                        )
                                            ? format(
                                                  new Date(
                                                      record.expected_closing_date
                                                  ),
                                                  'PP'
                                              )
                                            : 'Invalid date'}
                                    </Typography>
                                    {new Date(record.expected_closing_date) <
                                    new Date() ? (
                                        <Chip
                                            label="Past"
                                            color="error"
                                            size="small"
                                        />
                                    ) : null}
                                </Stack>
                            </Box>

                            <Box display="flex" mr={5} flexDirection="column">
                                <Typography
                                    color="textSecondary"
                                    variant="caption"
                                >
                                    Budget
                                </Typography>
                                <Typography variant="body2">
                                    {record.amount.toLocaleString('en-US', {
                                        notation: 'compact',
                                        style: 'currency',
                                        currency: 'USD',
                                        currencyDisplay: 'narrowSymbol',
                                        minimumSignificantDigits: 3,
                                    })}
                                </Typography>
                            </Box>

                            {record.category && (
                                <Box
                                    display="flex"
                                    mr={5}
                                    flexDirection="column"
                                >
                                    <Typography
                                        color="textSecondary"
                                        variant="caption"
                                    >
                                        Category
                                    </Typography>
                                    <Typography variant="body2">
                                        {record.category}
                                    </Typography>
                                </Box>
                            )}

                            <Box display="flex" mr={5} flexDirection="column">
                                <Typography
                                    color="textSecondary"
                                    variant="caption"
                                >
                                    Stage
                                </Typography>
                                <Typography variant="body2">
                                    {findEngagementLabel(engagementStages, record.stage)}
                                </Typography>
                            </Box>
                        </Box>

                        {!!record.contact_ids?.length && (
                            <Box m={2}>
                                <Box
                                    display="flex"
                                    mr={5}
                                    flexDirection="column"
                                    minHeight={48}
                                >
                                    <Typography
                                        color="textSecondary"
                                        variant="caption"
                                    >
                                        Contacts
                                    </Typography>
                                    <ReferenceArrayField
                                        source="contact_ids"
                                        reference="contacts_summary"
                                    >
                                        <ContactList />
                                    </ReferenceArrayField>
                                </Box>
                            </Box>
                        )}

                        {record.description && (
                            <Box m={2} sx={{ whiteSpace: 'pre-line' }}>
                                <Typography
                                    color="textSecondary"
                                    variant="caption"
                                >
                                    Description
                                </Typography>
                                <Typography variant="body2">
                                    {record.description}
                                </Typography>
                            </Box>
                        )}

                        <Box m={2}>
                            <Divider />
                            <ReferenceManyField
                                target="engagement_id"
                                reference="engagementNotes"
                                sort={{ field: 'date', order: 'DESC' }}
                            >
                                <NotesIterator reference="engagements" />
                            </ReferenceManyField>
                        </Box>
                    </Box>
                </Box>
            </Stack>
        </>
    );
};

const ArchivedTitle = () => (
    <Box
        sx={{
            background: theme => theme.palette.warning.main,
            px: 3,
            py: 2,
        }}
    >
        <Typography
            variant="h6"
            fontWeight="bold"
            sx={{
                color: theme => theme.palette.warning.contrastText,
            }}
        >
            Archived Engagement
        </Typography>
    </Box>
);

const ArchiveButton = ({ record }: { record: Engagement }) => {
    const [update] = useUpdate();
    const redirect = useRedirect();
    const notify = useNotify();
    const refresh = useRefresh();
    const handleClick = () => {
        update(
            'engagements',
            {
                id: record.id,
                data: { archived_at: new Date().toISOString() },
                previousData: record,
            },
            {
                onSuccess: () => {
                    redirect('list', 'engagements');
                    notify('Engagement archived', { type: 'info', undoable: false });
                    refresh();
                },
                onError: () => {
                    notify('Error: engagement not archived', { type: 'error' });
                },
            }
        );
    };

    return (
        <Button onClick={handleClick} startIcon={<ArchiveIcon />} size="small">
            Archive
        </Button>
    );
};

const UnarchiveButton = ({ record }: { record: Engagement }) => {
    const dataProvider = useDataProvider();
    const redirect = useRedirect();
    const notify = useNotify();
    const refresh = useRefresh();

    const { mutate } = useMutation({
        mutationFn: () => dataProvider.unarchiveEngagement(record),
        onSuccess: () => {
            redirect('list', 'engagements');
            notify('Engagement unarchived', {
                type: 'info',
                undoable: false,
            });
            refresh();
        },
        onError: () => {
            notify('Error: engagement not unarchived', { type: 'error' });
        },
    });

    const handleClick = () => {
        mutate();
    };

    return (
        <Button
            onClick={handleClick}
            startIcon={<UnarchiveIcon />}
            size="small"
        >
            Send back to the board
        </Button>
    );
};

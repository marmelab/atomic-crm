import EmailIcon from '@mui/icons-material/Email';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import PhoneIcon from '@mui/icons-material/Phone';
import {
    Box,
    Button,
    Divider,
    Stack,
    SvgIcon,
    Typography,
} from '@mui/material';
import {
    ArrayField,
    DateField,
    DeleteButton,
    EditButton,
    EmailField,
    FunctionField,
    ReferenceField,
    ReferenceManyField,
    SelectField,
    ShowButton,
    SingleFieldList,
    TextField,
    UrlField,
    useDataProvider,
    useRecordContext,
    WithRecord,
} from 'react-admin';
import { AddTask } from '../tasks/AddTask';
import { TasksIterator } from '../tasks/TasksIterator';
import { TagsListEdit } from './TagsListEdit';

import { useLocation } from 'react-router';
import { useConfigurationContext } from '../root/ConfigurationContext';
import { CallData, Contact, Sale } from '../types';
import { ReactNode, useCallback } from 'react';
import { CrmDataProvider } from '../providers/types';

import { useMutation } from '@tanstack/react-query';

export const ContactAside = ({ link = 'edit' }: { link?: 'edit' | 'show' }) => {
    const location = useLocation();
    const { contactGender } = useConfigurationContext();
    const dataProvider = useDataProvider<CrmDataProvider>(); //

    const { mutate, error } = useMutation({
        mutationKey: ['createCall'],
        mutationFn: async (data: CallData) => {
            return dataProvider.createCall(data); //
        },
    });

    const initiateCall = useCallback(
        (recipientId: number, phoneNumber: string) => {
            if (!recipientId || !phoneNumber) {
                alert('Please enter recipient ID and phone number');
                return;
            }

            mutate({
                recipient_id: recipientId,
                phone_number: phoneNumber,
                caller_id: 1,
            });

            if (error) {
                console.error('Error initiating call:', error);
                alert('Failed to initiate call');
            } else {
                alert('Call initiated successfully!');
            }
        },
        [mutate, error]
    );

    const record = useRecordContext<Contact>();
    if (!record) return null;
    return (
        <Box ml={4} width={250} minWidth={250}>
            <Box mb={2} ml="-5px">
                {link === 'edit' ? (
                    <EditButton label="Edit Contact" />
                ) : (
                    <ShowButton label="Show Contact" />
                )}
            </Box>
            <Typography variant="subtitle2">Personal info</Typography>
            <Divider sx={{ mb: 2 }} />
            <ArrayField source="email_jsonb">
                <SingleFieldList linkType={false} gap={0} direction="column">
                    <PersonalInfoRow
                        icon={<EmailIcon color="disabled" fontSize="small" />}
                        primary={<EmailField source="email" />}
                        showType
                    />
                </SingleFieldList>
            </ArrayField>
            {record.has_newsletter && (
                <Typography variant="body2" color="textSecondary" pl={3.5}>
                    Subscribed to newsletter
                </Typography>
            )}

            {record.linkedin_url && (
                <PersonalInfoRow
                    icon={<LinkedInIcon color="disabled" fontSize="small" />}
                    primary={
                        <UrlField
                            source="linkedin_url"
                            content="LinkedIn profile"
                            target="_blank"
                            rel="noopener"
                        />
                    }
                />
            )}
            <ArrayField source="phone_jsonb">
                <SingleFieldList linkType={false} gap={0} direction="column">
                    <PersonalInfoRow
                        icon={<PhoneIcon color="success" fontSize="small" />}
                        primary={<TextField source="number" />}
                        showType
                        initiateCall={initiateCall}

                    />
                </SingleFieldList>
            </ArrayField>
            <SelectField
                source="gender"
                choices={contactGender}
                optionText={choice => (
                    <PersonalInfoRow
                        icon={
                            <SvgIcon
                                component={choice.icon}
                                color="disabled"
                                fontSize="small"
                            />
                        }
                        primary={<span>{choice.label}</span>}
                    />
                )}
                optionValue="value"
            />
            <Typography variant="subtitle2" mt={2}>
                Background info
            </Typography>
            <Divider />
            <Typography variant="body2" mt={2}>
                {record && record.background}
            </Typography>
            <Box mt={1} mb={3}>
                <Typography
                    component="span"
                    variant="body2"
                    color="textSecondary"
                >
                    Added on
                </Typography>{' '}
                <DateField
                    source="first_seen"
                    options={{ year: 'numeric', month: 'long', day: 'numeric' }}
                    color="textSecondary"
                />
                <br />
                <Typography
                    component="span"
                    variant="body2"
                    color="textSecondary"
                >
                    Last activity on
                </Typography>{' '}
                <DateField
                    source="last_seen"
                    options={{ year: 'numeric', month: 'long', day: 'numeric' }}
                    color="textSecondary"
                />
                <br />
                <Typography
                    component="span"
                    variant="body2"
                    color="textSecondary"
                >
                    Followed by
                </Typography>{' '}
                <ReferenceField source="sales_id" reference="sales">
                    <FunctionField<Sale>
                        source="last_name"
                        render={record =>
                            `${record.first_name} ${record.last_name}`
                        }
                    />
                </ReferenceField>
            </Box>
            <Box mb={3}>
                <Typography variant="subtitle2">Tags</Typography>
                <Divider />
                <TagsListEdit />
            </Box>
            <Box mb={3}>
                <Typography variant="subtitle2">Tasks</Typography>
                <Divider />
                <ReferenceManyField
                    target="contact_id"
                    reference="tasks"
                    sort={{ field: 'due_date', order: 'ASC' }}
                >
                    <TasksIterator />
                </ReferenceManyField>
                <AddTask />
            </Box>
            <DeleteButton redirect={location.state?.from || undefined} />
        </Box>
    );
};

const PersonalInfoRow = ({
    icon,
    primary,
    showType,
    initiateCall,
}: {
    icon: ReactNode;
    primary: ReactNode;
    showType?: boolean;
    initiateCall?: (recipientId: number, phoneNumber: string) => void;
}) => (
    <Stack direction="row" alignItems="center" gap={1} minHeight={24}>
        {icon}
        <Button
            onClick={() => {
                initiateCall && initiateCall(1, '0764671415');
            }}
        >
            <Box display="flex" flexWrap="wrap" columnGap={0.5} rowGap={0}>
                {primary}
                {showType ? (
                    <WithRecord
                        render={row =>
                            row.type !== 'Other' && (
                                <TextField
                                    source="type"
                                    color="textSecondary"
                                />
                            )
                        }
                    />
                ) : null}
            </Box>
        </Button>
    </Stack>
);

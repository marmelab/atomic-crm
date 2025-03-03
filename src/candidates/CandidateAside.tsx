import EmailIcon from '@mui/icons-material/Email';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import PhoneIcon from '@mui/icons-material/Phone';
import { Box, Divider, Stack, SvgIcon, Typography } from '@mui/material';
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
    useRecordContext,
    WithRecord,
} from 'react-admin';
import { AddTask } from '../tasks/AddTask';
import { TasksIterator } from '../tasks/TasksIterator';
import { TagsListEdit } from './TagsListEdit';

import { useLocation } from 'react-router';
import { useConfigurationContext } from '../root/ConfigurationContext';
import { Candidate, Sale } from '../types';
import { ReactNode } from 'react';

export const CandidateAside = ({ link = 'edit' }: { link?: 'edit' | 'show' }) => {
    const location = useLocation();
    const { contactGender } = useConfigurationContext();
    const record = useRecordContext<Candidate>();
    if (!record) return null;
    return (
        <Box ml={4} width={250} minWidth={250}>
            <Box mb={2} ml="-5px">
                {link === 'edit' ? (
                    <EditButton label="Edit Candidate" />
                ) : (
                    <ShowButton label="Show Candidate" />
                )}
            </Box>
            <Typography variant="subtitle2">Personal info</Typography>
            <Divider sx={{ mb: 2 }} />
            <ArrayField source="emails">
                <SingleFieldList linkType={false} gap={0} direction="column">
                    <PersonalInfoRow
                        icon={<EmailIcon color="disabled" fontSize="small" />}
                        primary={<EmailField source="email" />}
                        showType
                    />
                </SingleFieldList>
            </ArrayField>

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
            <ArrayField source="phone_numbers">
                <SingleFieldList linkType={false} gap={0} direction="column">
                    <PersonalInfoRow
                        icon={<PhoneIcon color="disabled" fontSize="small" />}
                        primary={<TextField source="number" />}
                        showType
                    />
                </SingleFieldList>
            </ArrayField>

            <Typography variant="subtitle2" mt={2}>
                Skills & Experience
            </Typography>
            <Divider />
            <Box mt={1}>
                <Typography variant="body2">
                    {record.working_years} years of experience
                </Typography>
                <Typography variant="body2">
                    Education: {record.education_level}
                </Typography>
                {record.programming_languages && record.programming_languages.length > 0 && (
                    <Typography variant="body2">
                        Languages: {record.programming_languages.join(', ')}
                    </Typography>
                )}
            </Box>

            <Typography variant="subtitle2" mt={2}>
                Hiring Status
            </Typography>
            <Divider />
            <Box mt={1}>
                <Typography variant="body2">
                    Stage: {record.hiring_stage}
                </Typography>
                <Typography variant="body2">
                    Available: {record.availability_status}
                    {record.availability_date && ` (${new Date(record.availability_date).toLocaleDateString()})`}
                </Typography>
                {record.salary_expectation_min && record.salary_expectation_max && (
                    <Typography variant="body2">
                        Expected Salary: ${record.salary_expectation_min.toLocaleString()} - ${record.salary_expectation_max.toLocaleString()}
                    </Typography>
                )}
            </Box>

            <Typography variant="subtitle2" mt={2}>
                Background info
            </Typography>
            <Divider />
            <Typography variant="body2" mt={2}>
                {record.background}
            </Typography>

            <Box mt={1} mb={3}>
                <Typography variant="body2" color="textSecondary">
                    Added on{' '}
                    <DateField
                        source="created_at"
                        options={{ year: 'numeric', month: 'long', day: 'numeric' }}
                    />
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    Last updated{' '}
                    <DateField
                        source="updated_at"
                        options={{ year: 'numeric', month: 'long', day: 'numeric' }}
                    />
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    Recruiter:{' '}
                    <ReferenceField source="sales_id" reference="sales">
                        <FunctionField<Sale>
                            render={record =>
                                `${record.first_name} ${record.last_name}`
                            }
                        />
                    </ReferenceField>
                </Typography>
            </Box>

            <Box mb={3}>
                <Typography variant="subtitle2">Tags</Typography>
                <Divider />
                <TagsListEdit />
            </Box>

            <DeleteButton redirect={location.state?.from || undefined} />
        </Box>
    );
};

const PersonalInfoRow = ({
    icon,
    primary,
    showType,
}: {
    icon: ReactNode;
    primary: ReactNode;
    showType?: boolean;
}) => (
    <Stack direction="row" alignItems="center" gap={1} minHeight={24}>
        {icon}
        <Box display="flex" flexWrap="wrap" columnGap={0.5} rowGap={0}>
            {primary}
            {showType ? (
                <WithRecord
                    render={row =>
                        row.type !== 'Other' && (
                            <TextField source="type" color="textSecondary" />
                        )
                    }
                />
            ) : null}
        </Box>
    </Stack>
);

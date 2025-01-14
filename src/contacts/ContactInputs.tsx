import * as React from 'react';
import {
    Divider,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    ArrayInput,
    AutocompleteInput,
    BooleanInput,
    RadioButtonGroupInput,
    ReferenceInput,
    SelectInput,
    SimpleFormIterator,
    TextInput,
    email,
    required,
    useCreate,
    useGetIdentity,
    useNotify,
} from 'react-admin';
import { useFormContext } from 'react-hook-form';

import { isLinkedinUrl } from '../misc/isLinkedInUrl';
import { useConfigurationContext } from '../root/ConfigurationContext';
import { Sale } from '../types';
import { Avatar } from './Avatar';

export const ContactInputs = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    return (
        <Stack gap={2} p={1}>
            <Avatar />
            <Stack gap={3} direction={isMobile ? 'column' : 'row'}>
                <Stack gap={4} flex={4}>
                    <ContactIdentityInputs />
                    <ContactPositionInputs />
                </Stack>
                <Divider
                    orientation={isMobile ? 'horizontal' : 'vertical'}
                    flexItem
                />
                <Stack gap={4} flex={5}>
                    <ContactPersonalInformationInputs />
                    <ContactMiscInputs />
                </Stack>
            </Stack>
        </Stack>
    );
};

const ContactIdentityInputs = () => {
    const { contactGender } = useConfigurationContext();
    return (
        <Stack>
            <Typography variant="h6">Identity</Typography>
            <RadioButtonGroupInput
                label={false}
                source="gender"
                choices={contactGender}
                helperText={false}
                optionText="label"
                optionValue="value"
                sx={{ '& .MuiRadio-root': { paddingY: 0 } }}
                defaultValue={contactGender[0].value}
            />
            <TextInput
                source="first_name"
                validate={required()}
                helperText={false}
            />
            <TextInput
                source="last_name"
                validate={required()}
                helperText={false}
            />
        </Stack>
    );
};

const ContactPositionInputs = () => {
    const [create] = useCreate();
    const { identity } = useGetIdentity();
    const notify = useNotify();
    const handleCreateCompany = async (name?: string) => {
        if (!name) return;
        try {
            const newCompany = await create(
                'companies',
                {
                    data: {
                        name,
                        sales_id: identity?.id,
                        created_at: new Date().toISOString(),
                    },
                },
                { returnPromise: true }
            );
            return newCompany;
        } catch (error) {
            notify('An error occurred while creating the company', {
                type: 'error',
            });
        }
    };
    return (
        <Stack>
            <Typography variant="h6">Position</Typography>
            <TextInput source="title" helperText={false} />
            <ReferenceInput source="company_id" reference="companies">
                <AutocompleteInput
                    optionText="name"
                    onCreate={handleCreateCompany}
                    helperText={false}
                />
            </ReferenceInput>
        </Stack>
    );
};

const ContactPersonalInformationInputs = () => {
    const { getValues, setValue } = useFormContext();

    // set first and last name based on email
    const handleEmailChange = (email: string) => {
        const { first_name, last_name } = getValues();
        if (first_name || last_name || !email) return;
        const [first, last] = email.split('@')[0].split('.');
        setValue('first_name', first.charAt(0).toUpperCase() + first.slice(1));
        setValue(
            'last_name',
            last ? last.charAt(0).toUpperCase() + last.slice(1) : ''
        );
    };

    const handleEmailPaste: React.ClipboardEventHandler<HTMLDivElement> = e => {
        const email = e.clipboardData?.getData('text/plain');
        handleEmailChange(email);
    };

    const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const email = e.target.value;
        handleEmailChange(email);
    };

    return (
        <Stack>
            <Typography variant="h6">Personal info</Typography>
            <ArrayInput
                source="email_jsonb"
                label="Email addresses"
                helperText={false}
            >
                <SimpleFormIterator inline disableReordering>
                    <TextInput
                        source="email"
                        helperText={false}
                        validate={email()}
                        onPaste={handleEmailPaste}
                        onBlur={handleEmailBlur}
                    />
                    <SelectInput
                        source="type"
                        helperText={false}
                        optionText="id"
                        choices={personalInfoTypes}
                        defaultValue="Work"
                        fullWidth={false}
                        sx={{ width: 100, minWidth: 100 }}
                    />
                </SimpleFormIterator>
            </ArrayInput>
            <ArrayInput
                source="phone_jsonb"
                label="Phone numbers"
                helperText={false}
            >
                <SimpleFormIterator inline disableReordering>
                    <TextInput source="number" helperText={false} />
                    <SelectInput
                        source="type"
                        helperText={false}
                        optionText="id"
                        choices={personalInfoTypes}
                        defaultValue="Work"
                        fullWidth={false}
                        sx={{ width: 100, minWidth: 100 }}
                    />
                </SimpleFormIterator>
            </ArrayInput>
            <TextInput
                source="linkedin_url"
                label="Linkedin URL"
                helperText={false}
                validate={isLinkedinUrl}
            />
        </Stack>
    );
};

const personalInfoTypes = [{ id: 'Work' }, { id: 'Home' }, { id: 'Other' }];

const ContactMiscInputs = () => {
    return (
        <Stack>
            <Typography variant="h6">Misc</Typography>
            <TextInput
                source="background"
                label="Background info (bio, how you met, etc)"
                multiline
                helperText={false}
            />
            <BooleanInput source="has_newsletter" helperText={false} />
            <ReferenceInput
                reference="sales"
                source="sales_id"
                sort={{ field: 'last_name', order: 'ASC' }}
                filter={{
                    'disabled@neq': true,
                }}
            >
                <SelectInput
                    helperText={false}
                    label="Account manager"
                    optionText={saleOptionRenderer}
                    validate={required()}
                />
            </ReferenceInput>
        </Stack>
    );
};

const saleOptionRenderer = (choice: Sale) =>
    `${choice.first_name} ${choice.last_name}`;

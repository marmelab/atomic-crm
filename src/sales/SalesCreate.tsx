import { Card, Container, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import {
    PasswordInput,
    required,
    SimpleForm,
    useDataProvider,
    useNotify,
    useRedirect,
} from 'react-admin';
import { SubmitHandler } from 'react-hook-form';
import { CustomDataProvider } from '../dataProvider';
import { SalesFormData } from '../types';
import { SalesInputs } from './SalesInputs';

export function SalesCreate() {
    const dataProvider = useDataProvider<CustomDataProvider>();
    const notify = useNotify();
    const redirect = useRedirect();

    const { mutate } = useMutation({
        mutationKey: ['signup'],
        mutationFn: async (data: SalesFormData) => {
            return dataProvider.salesCreate(data);
        },
        onSuccess: () => {
            redirect('/sales');
        },
        onError: () => {
            notify('An error occurred. Please try again.');
        },
    });
    const onSubmit: SubmitHandler<SalesFormData> = async data => {
        mutate(data);
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 4 }}>
            <Card>
                <SimpleForm onSubmit={onSubmit as SubmitHandler<any>}>
                    <Typography variant="h6">Create sale person</Typography>
                    <SalesInputs>
                        <PasswordInput
                            source="password"
                            validate={required()}
                            helperText={false}
                        />
                    </SalesInputs>
                </SimpleForm>
            </Card>
        </Container>
    );
}

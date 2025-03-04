import {
    Button,
    CircularProgress,
    Container,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataProvider, useLogin, useNotify } from 'react-admin';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Navigate } from 'react-router';
import { Link, useNavigate } from 'react-router-dom';
import { CrmDataProvider } from '../providers/types';
import { useConfigurationContext } from '../root/ConfigurationContext';
import { SignUpData } from '../types';
import { LoginSkeleton } from './LoginSkeleton';
import { supabase } from '../providers/supabase/supabase';
import { useState } from 'react';
import AuthChecker, { deleteUser, updateUserPassword } from '../utils/helperFunctions';

export const SignupPage = () => {
    const queryClient = useQueryClient();
    const dataProvider = useDataProvider<CrmDataProvider>();
    const { logo, title } = useConfigurationContext();
    const [isLoading, setIsLoading] = useState(true);
    const { data: isInitialized, isPending } = useQuery({
        queryKey: ['init'],
        queryFn: async () => {
            return dataProvider.isInitialized();
        },
    });

    const navigate = useNavigate();
    AuthChecker({ navigate, setIsLoading });

    const { isPending: isSignUpPending, mutate } = useMutation({
        mutationKey: ['signup'],
        mutationFn: async (data: SignUpData) => {
            return dataProvider.signUp(data);
        },
        onSuccess: data => {
            login({
                email: data.email,
                password: data.password,
                redirectTo: '/contacts',
            }).then(() => {
                notify('Initial user successfully created');
                // FIXME: We should probably provide a hook for that in the ra-core package
                queryClient.invalidateQueries({
                    queryKey: ['auth', 'canAccess'],
                });
            });
        },
        onError: () => {
            notify('An error occurred. Please try again.');
        },
    });

    const login = useLogin();
    const notify = useNotify();

    const {
        register,
        handleSubmit,
        formState: { isValid },
    } = useForm<SignUpData>({
        mode: 'onChange',
    });

    if (isPending || isLoading) {
        return <LoginSkeleton />;
    }

    const onSubmit: SubmitHandler<SignUpData> = async data => {
        try {
            const { data: existingProfiles } = await dataProvider.getList(
                'profiles',
                {
                    filter: { email: data.email },
                    pagination: { page: 1, perPage: 1 },
                }
            );

            if (existingProfiles?.length) {
                let userId = existingProfiles[0].id
                await updateUserPassword(userId,data?.password)                
                await supabase
                    .from('profiles')
                    .update({
                        tenant_id: crypto.randomUUID(),
                        role: 'admin',
                    })
                    .eq('id', userId);

                await supabase
                    .from('sales')
                    .update({ administrator: true })
                    .eq('tenant_id', existingProfiles[0]?.tenant_id);
            } else {
                const { email, first_name, last_name }: any = data;

                let isNewTenant = true;
                let tenantId = crypto.randomUUID();
                const { data: authUser, error: authError } =
                    await supabase.auth.signUp({
                        email,
                        password: data.password,
                        options: {
                            data: {
                                first_name,
                                last_name,
                                tenant_id: tenantId,
                            },
                        },
                    });

                if (authError) throw authError;
                const userId = authUser?.user?.id;

                await dataProvider.create('profiles', {
                    data: {
                        id: userId,
                        email,
                        tenant_id: tenantId,
                        role: 'admin',
                    },
                });

                await supabase.from('sales').insert({
                    first_name,
                    last_name,
                    email,
                    user_id: authUser?.user?.id,
                    administrator: isNewTenant,
                    tenant_id: tenantId,
                });

                notify('Signup successful!');
                queryClient.invalidateQueries({
                    queryKey: ['auth', 'canAccess'],
                });

                notify('Signup successful!');
            }
            login({
                email: data.email,
                password: data.password,
                redirectTo: '/contacts',
            }).then(() => {
                notify('Initial user successfully created');
                // FIXME: We should probably provide a hook for that in the ra-core package
                queryClient.invalidateQueries({
                    queryKey: ['auth', 'canAccess'],
                });
            });
        } catch (error) {
            console.error('Error handling profile:', error);
            notify('An error occurred. Please try again.');
        }
    };

    return (
        <Stack sx={{ height: '100dvh', p: 2 }}>
            <Stack direction="row" alignItems="center" gap={1}>
                <img
                    src={logo}
                    alt={title}
                    width={24}
                    style={{ filter: 'invert(0.9)' }}
                />
                <Typography component="span" variant="h5">
                    {title}
                </Typography>
            </Stack>
            <Stack sx={{ height: '100%' }}>
                <Container
                    maxWidth="xs"
                    sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: 1,
                    }}
                >
                    <Typography variant="h4" component="h1" gutterBottom>
                        Welcome to Atomic CRM
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                        Create the first user account to complete the setup.
                    </Typography>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'cneter',
                            alignItems: 'center',
                            width: '100%',
                        }}
                    >
                        <TextField
                            {...register('first_name', { required: true })}
                            label="First name"
                            variant="outlined"
                            required
                        />
                        <TextField
                            {...register('last_name', { required: true })}
                            label="Last name"
                            variant="outlined"
                            required
                        />
                        <TextField
                            {...register('email', { required: true })}
                            label="Email"
                            type="email"
                            variant="outlined"
                            required
                        />
                        <TextField
                            {...register('password', { required: true })}
                            label="Password"
                            type="password"
                            variant="outlined"
                            required
                        />
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            mt={2}
                            mb={2}
                            style={{ width: '100%' }}
                        >
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={!isValid || isSignUpPending}
                                fullWidth
                            >
                                {isSignUpPending ? (
                                    <CircularProgress />
                                ) : (
                                    'Create account'
                                )}
                            </Button>
                        </Stack>
                        <Typography variant="body2">
                            Already have an account?{' '}
                            <Link
                                to="/login"
                                style={{
                                    textDecoration: 'none',
                                    color: '#1976d2',
                                    fontWeight: 'bold',
                                }}
                            >
                                Log In
                            </Link>
                        </Typography>
                    </form>
                </Container>
            </Stack>
        </Stack>
    );
};

SignupPage.path = '/sign-up';

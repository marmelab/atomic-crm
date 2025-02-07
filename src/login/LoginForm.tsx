import { styled } from '@mui/material/styles';
import {
    Button,
    CardActions,
    CardContent,
    CircularProgress,
    Typography,
} from '@mui/material';
import { Form, useLogin, useNotify, useSafeSetState } from 'ra-core';
import { Login, TextInput } from 'react-admin';
import { SubmitHandler } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { ForgotPasswordPage } from 'ra-supabase';

const PREFIX = 'RaLoginForm';

export const LoginFormClasses = {
    content: `${PREFIX}-content`,
    button: `${PREFIX}-button`,
    icon: `${PREFIX}-icon`,
};

const StyledForm = styled(Form, {
    name: PREFIX,
    overridesResolver: (props, styles) => styles.root,
})(({ theme }) => ({
    [`& .${LoginFormClasses.content}`]: {
        width: 300,
    },
    [`& .${LoginFormClasses.button}`]: {
        marginTop: theme.spacing(2),
    },
    [`& .${LoginFormClasses.icon}`]: {
        margin: theme.spacing(0.3),
    },
}));

export const LoginForm = () => {
    const [loading, setLoading] = useSafeSetState(false);
    const login = useLogin();
    const notify = useNotify();

    const submit: SubmitHandler<FieldValues> = values => {
        setLoading(true);
        login(values)
            .then(() => {
                setLoading(false);
            })
            .catch(error => {
                setLoading(false);
                notify(
                    typeof error === 'string'
                        ? error
                        : typeof error === 'undefined' || !error.message
                          ? 'ra.auth.sign_in_error'
                          : error.message,
                    {
                        type: 'error',
                        messageArgs: {
                            _:
                                typeof error === 'string'
                                    ? error
                                    : error && error.message
                                      ? error.message
                                      : undefined,
                        },
                    }
                );
            });
    };

    return (
        <Login>
            <StyledForm onSubmit={submit} mode="onChange" noValidate>
                <CardContent className={LoginFormClasses.content}>
                    <TextInput
                        autoFocus
                        source="email"
                        label="Email"
                        autoComplete="email"
                    />
                    <TextInput
                        source="password"
                        label="Password"
                        type="password"
                        autoComplete="current-password"
                    />
                </CardContent>
                <CardActions sx={{ flexDirection: 'column', gap: 1 }}>
                    <Button
                        variant="contained"
                        type="submit"
                        color="primary"
                        disabled={loading}
                        fullWidth
                        className={LoginFormClasses.button}
                    >
                        {loading ? (
                            <CircularProgress
                                className={LoginFormClasses.icon}
                                size={19}
                                thickness={3}
                            />
                        ) : (
                            'Sign In'
                        )}
                    </Button>
                    <Typography
                        component={Link}
                        to={ForgotPasswordPage.path}
                        variant="caption"
                    >
                        Forgot your password?
                    </Typography>
                </CardActions>
            </StyledForm>
        </Login>
    );
};

type FieldValues = Record<string, any>;

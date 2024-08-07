import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
} from '@mui/material';
import {
    Toolbar,
    useDataProvider,
    useGetIdentity,
    useNotify,
} from 'react-admin';
import { useForm } from 'react-hook-form';
import { DialogCloseButton } from '../misc/DialogCloseButton';
import { useMutation } from '@tanstack/react-query';
import { CustomDataProvider } from '../dataProvider';
import { UpdatePasswordData } from '../types';

const PASSWORD_POLICY = {
    regex: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/, // Example policy: Minimum 8 characters, at least one letter and one number
    text: 'Password must be at least 8 characters long and contain at least one letter and one number.',
};

export const UpdatePassword = ({
    open,
    setOpen,
}: {
    open: boolean;
    setOpen: (value: boolean) => void;
}) => {
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isValid },
        reset,
    } = useForm({
        mode: 'onChange',
    });
    const newPassword = watch('newPassword');
    const { identity } = useGetIdentity();
    const notify = useNotify();
    const dataProvider = useDataProvider<CustomDataProvider>();

    const { mutate } = useMutation({
        mutationKey: ['updatePassword'],
        mutationFn: async (data: UpdatePasswordData) => {
            if (!identity) {
                throw new Error('Record not found');
            }
            return dataProvider.updatePassword(identity.id, data);
        },
        onSuccess: () => {
            notify('Your password has been updated');
            setOpen(false);
            reset();
        },
        onError: e => {
            notify(`${e}`, {
                type: 'error',
            });
        },
    });

    if (!identity) return null;

    const onSubmit = async (data: any) => {
        mutate(data);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogCloseButton onClose={handleClose} />
            <DialogTitle>Change Password</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    <Stack gap={1}>
                        <TextField
                            {...register('currentPassword', {
                                required: 'Current password is required',
                            })}
                            required
                            autoFocus
                            margin="dense"
                            label="Current Password"
                            type="password"
                            fullWidth
                            error={!!errors.currentPassword}
                            helperText={
                                errors.currentPassword
                                    ? 'Current password is required'
                                    : ''
                            }
                        />
                        <TextField
                            {...register('newPassword', {
                                required: 'New password is required',
                                pattern: {
                                    value: PASSWORD_POLICY.regex,
                                    message: PASSWORD_POLICY.text,
                                },
                            })}
                            margin="dense"
                            label="New Password"
                            type="password"
                            required
                            fullWidth
                            error={!!errors.newPassword}
                            helperText={
                                errors.newPassword ? PASSWORD_POLICY.text : ''
                            }
                        />
                        <TextField
                            {...register('confirmNewPassword', {
                                required: 'Please confirm your new password',
                                validate: value =>
                                    value === newPassword ||
                                    'Passwords do not match',
                            })}
                            margin="dense"
                            label="Confirm New Password"
                            type="password"
                            required
                            fullWidth
                            error={!!errors.confirmNewPassword}
                            helperText={
                                errors.confirmNewPassword
                                    ? 'Passwords do not match'
                                    : ''
                            }
                        />
                    </Stack>
                </DialogContent>
                <DialogActions
                    sx={{
                        justifyContent: 'flex-start',
                        p: 0,
                    }}
                >
                    <Toolbar
                        sx={{
                            width: '100%',
                        }}
                    >
                        <Button
                            type="submit"
                            color="primary"
                            variant="contained"
                            disabled={!isValid}
                        >
                            Update
                        </Button>
                    </Toolbar>
                </DialogActions>
            </form>
        </Dialog>
    );
};

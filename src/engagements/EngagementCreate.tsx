import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import {
    Create,
    Form,
    GetListResult,
    SaveButton,
    Toolbar,
    useDataProvider,
    useGetIdentity,
    useListContext,
    useRedirect,
} from 'react-admin';
import { DialogCloseButton } from '../misc/DialogCloseButton';
import { Engagement } from '../types';
import { EngagementInputs } from './EngagementInputs';

export const EngagementCreate = ({ open }: { open: boolean }) => {
    const redirect = useRedirect();
    const dataProvider = useDataProvider();
    const { data: allEngagements } = useListContext<Engagement>();

    const handleClose = () => {
        redirect('/engagements');
    };

    const queryClient = useQueryClient();

    const onSuccess = async (engagement: Engagement) => {
        if (!allEngagements) {
            redirect('/engagements');
            return;
        }
        // increase the index of all engagements in the same stage as the new engagement
        // first, get the list of engagements in the same stage
        const engagements = allEngagements.filter(
            (e: Engagement) => e.stage === engagement.stage && e.id !== engagement.id
        );
        // update the actual engagements in the database
        await Promise.all(
            engagements.map(async oldEngagement =>
                dataProvider.update('engagements', {
                    id: oldEngagement.id,
                    data: { index: oldEngagement.index + 1 },
                    previousData: oldEngagement,
                })
            )
        );
        // refresh the list of engagements in the cache as we used dataProvider.update(),
        // which does not update the cache
        const engagementsById = engagements.reduce(
            (acc, e) => ({
                ...acc,
                [e.id]: { ...e, index: e.index + 1 },
            }),
            {} as { [key: string]: Engagement }
        );
        const now = Date.now();
        queryClient.setQueriesData<GetListResult | undefined>(
            { queryKey: ['engagements', 'getList'] },
            res => {
                if (!res) return res;
                return {
                    ...res,
                    data: res.data.map((e: Engagement) => engagementsById[e.id] || e),
                };
            },
            { updatedAt: now }
        );
        redirect('/engagements');
    };

    const { identity } = useGetIdentity();

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
            <Create<Engagement>
                resource="engagements"
                mutationOptions={{ onSuccess }}
                sx={{ '& .RaCreate-main': { mt: 0 } }}
            >
                <DialogCloseButton onClose={handleClose} />
                <DialogTitle
                    sx={{
                        paddingBottom: 0,
                    }}
                >
                    Create a new engagement
                </DialogTitle>
                <Form
                    defaultValues={{
                        sales_id: identity?.id,
                        contact_ids: [],
                        index: 0,
                    }}
                >
                    <DialogContent>
                        <EngagementInputs />
                    </DialogContent>
                    <Toolbar>
                        <SaveButton />
                    </Toolbar>
                </Form>
            </Create>
        </Dialog>
    );
};

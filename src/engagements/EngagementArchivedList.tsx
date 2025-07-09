import {
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    Grid,
    Stack,
    Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useGetIdentity, useGetList } from 'react-admin';
import { EngagementCard } from './EngagementCard';
import { Engagement } from '../types';
import { DialogCloseButton } from '../misc/DialogCloseButton';

export const EngagementArchivedList = () => {
    const { identity } = useGetIdentity();
    const {
        data: archivedLists,
        total,
        isPending,
    } = useGetList('engagements', {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: 'archived_at', order: 'DESC' },
        filter: { 'archived_at@not.is': null },
    });
    const [openDialog, setOpenDialog] = useState(false);

    useEffect(() => {
        if (!isPending && total === 0) {
            setOpenDialog(false);
        }
    }, [isPending, total]);

    useEffect(() => {
        setOpenDialog(false);
    }, [archivedLists]);

    if (!identity || isPending || !total || !archivedLists) return null;

    // Group archived lists by date
    const archivedListsByDate: { [date: string]: Engagement[] } =
        archivedLists.reduce(
            (acc, engagement) => {
                const date = new Date(engagement.archived_at).toDateString();
                if (!acc[date]) {
                    acc[date] = [];
                }
                acc[date].push(engagement);
                return acc;
            },
            {} as { [date: string]: Engagement[] }
        );

    return (
        <>
            <Button
                variant="text"
                onClick={() => setOpenDialog(true)}
                sx={{ my: 1 }}
            >
                View archived engagements
            </Button>
            <Dialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                fullWidth
                maxWidth="lg"
            >
                <DialogCloseButton onClose={() => setOpenDialog(false)} />
                <DialogTitle>Archived Engagements</DialogTitle>
                <DialogContent>
                    <Stack gap={2}>
                        {Object.entries(archivedListsByDate).map(
                            ([date, engagements]) => (
                                <Stack key={date} gap={1}>
                                    <Typography
                                        variant="body1"
                                        fontWeight="bold"
                                    >
                                        {getRelativeTimeString(date)}
                                    </Typography>
                                    <Grid container spacing={2}>
                                        {engagements.map((engagement: Engagement, idx) => (
                                            <Grid
                                                item
                                                xs={12}
                                                sm={6}
                                                md={4}
                                                key={engagement.id}
                                            >
                                                <EngagementCard engagement={engagement} index={idx} />
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Stack>
                            )
                        )}
                    </Stack>
                </DialogContent>
            </Dialog>
        </>
    );
};

export function getRelativeTimeString(dateString: string): string {
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diff = date.getTime() - today.getTime();
    const unitDiff = Math.round(diff / (1000 * 60 * 60 * 24));

    // Check if the date is more than one week old
    if (Math.abs(unitDiff) > 7) {
        return new Intl.DateTimeFormat(undefined, {
            day: 'numeric',
            month: 'long',
        }).format(date);
    }

    // Intl.RelativeTimeFormat for dates within the last week
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    return ucFirst(rtf.format(unitDiff, 'day'));
}

function ucFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

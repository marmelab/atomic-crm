import type { ActivityEngagementNoteCreated } from '../types';
import { SaleName } from '../sales/SaleName';
import { RelativeDate } from '../misc/RelativeDate';
import { ActivityLogNote } from './ActivityLogNote';
import { useActivityLogContext } from './ActivityLogContext';

// This is the renamed version of the previous ActivityLogDealNoteCreated

type ActivityLogEngagementNoteCreatedProps = {
    activity: ActivityEngagementNoteCreated;
};

export function ActivityLogEngagementNoteCreated({
    activity,
}: ActivityLogEngagementNoteCreatedProps) {
    const context = useActivityLogContext();
    const { engagementNote } = activity;
    return (
        <ActivityLogNote
            header={
                <>
                    <span>
                        <SaleName sale={undefined} /> added a note about engagement{' '}
                        <b>{engagementNote.text}</b> {' '}
                        <RelativeDate date={engagementNote.date} />
                    </span>
                </>
            }
            text={engagementNote.text}
        />
    );
} 
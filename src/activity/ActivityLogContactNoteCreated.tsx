import { Typography } from '@mui/material';
import { Link, ReferenceField } from 'react-admin';

import { Avatar } from '../contacts/Avatar';
import type { ActivityContactNoteCreated } from '../types';
import { SaleName } from '../sales/SaleName';
import { ActivityLogNote } from './ActivityLogNote';
import { RelativeDate } from '../misc/RelativeDate';
import { useActivityLogContext } from './ActivityLogContext';

type ActivityLogContactNoteCreatedProps = {
    activity: ActivityContactNoteCreated;
};

export function ActivityLogContactNoteCreated({
    activity,
}: ActivityLogContactNoteCreatedProps) {
    const context = useActivityLogContext();
    const { sale, contact, contactNote } = activity;
    return (
        <ActivityLogNote
            header={
                <>
                    <Avatar width={20} height={20} record={contact} />
                    <Typography
                        component="p"
                        variant="body2"
                        color="text.secondary"
                        flexGrow={1}
                    >
                        <SaleName sale={sale} /> added a note about{' '}
                        <Link to={`/contacts/${contact.id}/show`}>
                            {contact.first_name} {contact.last_name}
                        </Link>
                        {context !== 'company' && (
                            <>
                                {' from '}
                                <ReferenceField
                                    source="company_id"
                                    reference="companies"
                                    record={activity}
                                    link="show"
                                />{' '}
                                <RelativeDate date={activity.date} />
                            </>
                        )}
                    </Typography>
                    {context === 'company' && (
                        <Typography
                            color="textSecondary"
                            variant="body2"
                            component="span"
                        >
                            <RelativeDate date={activity.date} />
                        </Typography>
                    )}
                </>
            }
            text={contactNote.text}
        />
    );
}

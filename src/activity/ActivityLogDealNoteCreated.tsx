import Typography from '@mui/material/Typography';
import { Link, ReferenceField } from 'react-admin';

import { CompanyAvatar } from '../companies/CompanyAvatar';
import type { ActivityDealNoteCreated } from '../types';
import { SaleName } from '../sales/SaleName';
import { RelativeDate } from '../misc/RelativeDate';
import { ActivityLogNote } from './ActivityLogNote';
import { useActivityLogContext } from './ActivityLogContext';

type ActivityLogDealNoteCreatedProps = {
    activity: ActivityDealNoteCreated;
};

export function ActivityLogDealNoteCreated({
    activity,
}: ActivityLogDealNoteCreatedProps) {
    const context = useActivityLogContext();
    const { sale, deal, dealNote } = activity;
    return (
        <ActivityLogNote
            header={
                <>
                    <ReferenceField
                        source="company_id"
                        reference="companies"
                        record={activity}
                        link={false}
                    >
                        <CompanyAvatar width={20} height={20} />
                    </ReferenceField>
                    <Typography
                        component="p"
                        variant="body2"
                        color="text.secondary"
                        flexGrow={1}
                    >
                        <SaleName sale={sale} /> added a note about deal{' '}
                        <Link to={`/deals/${deal.id}/show`}>{deal.name}</Link>
                        {context !== 'company' && (
                            <>
                                {' at '}
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
            text={dealNote.text}
        />
    );
}

import * as React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import NoteIcon from '@mui/icons-material/Note';
import {
    useGetList,
    useGetIdentity,
    ReferenceField,
    TextField,
    FunctionField,
} from 'react-admin';
import { formatDistance } from 'date-fns';

import { Contact as ContactType } from '../types';

export const LatestNotes = () => {
    const { identity } = useGetIdentity();
    const { data: contactNotesData, isPending: contactNotesLoading } =
        useGetList(
            'contactNotes',
            {
                pagination: { page: 1, perPage: 5 },
                sort: { field: 'date', order: 'DESC' },
                filter: { sales_id: identity?.id },
            },
            { enabled: Number.isInteger(identity?.id) }
        );
    const { data: engagementNotesData, isPending: engagementNotesLoading } = useGetList(
        'engagementNotes',
        {
            pagination: { page: 1, perPage: 5 },
            sort: { field: 'date', order: 'DESC' },
            filter: { sales_id: identity?.id },
        },
        { enabled: Number.isInteger(identity?.id) }
    );
    if (contactNotesLoading || engagementNotesLoading) {
        return null;
    }
    // TypeScript guards
    if (!contactNotesData || !engagementNotesData) {
        return null;
    }

    const allNotes = ([] as any[])
        .concat(
            contactNotesData.map(note => ({
                ...note,
                type: 'contactNote',
            })),
            engagementNotesData.map(note => ({ ...note, type: 'engagementNote' }))
        )
        .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf())
        .slice(0, 5);

    return (
        <div>
            <Box display="flex" alignItems="center" marginBottom="1em">
                <Box ml={2} mr={2} display="flex">
                    <NoteIcon color="disabled" fontSize="large" />
                </Box>
                <Typography variant="h5" color="textSecondary">
                    My Latest Notes
                </Typography>
            </Box>
            <Card>
                <CardContent>
                    {allNotes.map(note => (
                        <Box
                            id={`${note.type}_${note.id}`}
                            key={`${note.type}_${note.id}`}
                            sx={{ marginBottom: 2 }}
                        >
                            <Typography
                                variant="body2"
                                color="textSecondary"
                                component="div"
                            >
                                on{' '}
                                {note.type === 'engagementNote' ? (
                                    <Engagement note={note} />
                                ) : (
                                    <Contact note={note} />
                                )}
                                , added{' '}
                                {formatDistance(note.date, new Date(), {
                                    addSuffix: true,
                                })}
                            </Typography>
                            <div>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {note.text}
                                </Typography>
                            </div>
                        </Box>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
};

const Engagement = ({ note }: any) => (
    <>
        Engagement{' '}
        <ReferenceField
            record={note}
            source="engagement_id"
            reference="engagements"
            link="show"
        >
            <TextField source="name" variant="body2" />
        </ReferenceField>
    </>
);

const Contact = ({ note }: any) => (
    <>
        Contact{' '}
        <ReferenceField
            record={note}
            source="contact_id"
            reference="contacts"
            link="show"
        >
            <FunctionField<ContactType>
                variant="body2"
                render={contact => `${contact.first_name} ${contact.last_name}`}
            />
        </ReferenceField>
    </>
);
